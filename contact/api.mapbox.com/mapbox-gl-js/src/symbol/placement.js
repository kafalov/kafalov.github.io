// @flow

import CollisionIndex from './collision_index';
import EXTENT from '../data/extent';
import * as symbolSize from './symbol_size';
import * as projection from './projection';
import {getAnchorJustification, evaluateVariableOffset} from './symbol_layout';
import {getAnchorAlignment, WritingMode} from './shaping';
import assert from 'assert';
import pixelsToTileUnits from '../source/pixels_to_tile_units';
import Point from '@mapbox/point-geometry';
import type Transform from '../geo/transform';
import type StyleLayer from '../style/style_layer';

import type Tile from '../source/tile';
import type SymbolBucket, {CollisionArrays, SingleCollisionBox} from '../data/bucket/symbol_bucket';
import type {mat4} from 'gl-matrix';
import type {CollisionBoxArray, CollisionVertexArray, SymbolInstance} from '../data/array_types';
import type FeatureIndex from '../data/feature_index';
import type {OverscaledTileID} from '../source/tile_id';
import type {TextAnchor} from './symbol_layout';

class OpacityState {
    opacity: number;
    placed: boolean;
    constructor(prevState: ?OpacityState, increment: number, placed: boolean, skipFade: ?boolean) {
        if (prevState) {
            this.opacity = Math.max(0, Math.min(1, prevState.opacity + (prevState.placed ? increment : -increment)));
        } else {
            this.opacity = (skipFade && placed) ? 1 : 0;
        }
        this.placed = placed;
    }
    isHidden() {
        return this.opacity === 0 && !this.placed;
    }
}

class JointOpacityState {
    text: OpacityState;
    icon: OpacityState;
    constructor(prevState: ?JointOpacityState, increment: number, placedText: boolean, placedIcon: boolean, skipFade: ?boolean) {
        this.text = new OpacityState(prevState ? prevState.text : null, increment, placedText, skipFade);
        this.icon = new OpacityState(prevState ? prevState.icon : null, increment, placedIcon, skipFade);
    }
    isHidden() {
        return this.text.isHidden() && this.icon.isHidden();
    }
}

class JointPlacement {
    text: boolean;
    icon: boolean;
    // skipFade = outside viewport, but within CollisionIndex::viewportPadding px of the edge
    // Because these symbols aren't onscreen yet, we can skip the "fade in" animation,
    // and if a subsequent viewport change brings them into view, they'll be fully
    // visible right away.
    skipFade: boolean;
    constructor(text: boolean, icon: boolean, skipFade: boolean) {
        this.text = text;
        this.icon = icon;
        this.skipFade = skipFade;
    }
}

export class RetainedQueryData {
    bucketInstanceId: number;
    featureIndex: FeatureIndex;
    sourceLayerIndex: number;
    bucketIndex: number;
    tileID: OverscaledTileID;
    featureSortOrder: ?Array<number>
    constructor(bucketInstanceId: number,
                featureIndex: FeatureIndex,
                sourceLayerIndex: number,
                bucketIndex: number,
                tileID: OverscaledTileID) {
        this.bucketInstanceId = bucketInstanceId;
        this.featureIndex = featureIndex;
        this.sourceLayerIndex = sourceLayerIndex;
        this.bucketIndex = bucketIndex;
        this.tileID = tileID;
    }
}

type CollisionGroup = { ID: number, predicate?: any };

class CollisionGroups {
    collisionGroups: {[groupName: string]: CollisionGroup};
    maxGroupID: number;
    crossSourceCollisions: boolean;

    constructor(crossSourceCollisions: boolean) {
        this.crossSourceCollisions = crossSourceCollisions;
        this.maxGroupID = 0;
        this.collisionGroups = {};
    }

    get(sourceID: string) {
        // The predicate/groupID mechanism allows for arbitrary grouping,
        // but the current interface defines one source == one group when
        // crossSourceCollisions == true.
        if (!this.crossSourceCollisions) {
            if (!this.collisionGroups[sourceID]) {
                const nextGroupID = ++this.maxGroupID;
                this.collisionGroups[sourceID] = {
                    ID: nextGroupID,
                    predicate: (key) => {
                        return key.collisionGroupID === nextGroupID;
                    }
                };
            }
            return this.collisionGroups[sourceID];
        } else {
            return {ID: 0, predicate: null};
        }
    }
}

function calculateVariableLayoutShift(anchor: TextAnchor, width: number, height: number, textOffset: [number, number], textBoxScale: number): Point {
    const {horizontalAlign, verticalAlign} = getAnchorAlignment(anchor);
    const shiftX = -(horizontalAlign - 0.5) * width;
    const shiftY = -(verticalAlign - 0.5) * height;
    const offset = evaluateVariableOffset(anchor, textOffset);
    return new Point(
        shiftX + offset[0] * textBoxScale,
        shiftY + offset[1] * textBoxScale
    );
}

function shiftVariableCollisionBox(collisionBox: SingleCollisionBox,
                                  shiftX: number, shiftY: number,
                                  rotateWithMap: boolean, pitchWithMap: boolean,
                                  angle: number) {
    const {x1, x2, y1, y2, anchorPointX, anchorPointY} = collisionBox;
    const rotatedOffset = new Point(shiftX, shiftY);
    if (rotateWithMap) {
        rotatedOffset._rotate(pitchWithMap ? angle : -angle);
    }
    return {
        x1: x1 + rotatedOffset.x,
        y1: y1 + rotatedOffset.y,
        x2: x2 + rotatedOffset.x,
        y2: y2 + rotatedOffset.y,
        // symbol anchor point stays the same regardless of text-anchor
        anchorPointX,
        anchorPointY
    };
}

export type VariableOffset = {
    textOffset: [number, number],
    width: number,
    height: number,
    anchor: TextAnchor,
    textBoxScale: number,
    prevAnchor?: TextAnchor
};

export type CrossTileID = string | number;

export class Placement {
    transform: Transform;
    collisionIndex: CollisionIndex;
    placements: { [CrossTileID]: JointPlacement };
    opacities: { [CrossTileID]: JointOpacityState };
    variableOffsets: {[CrossTileID]: VariableOffset };
    placedOrientations: {[CrossTileID]: number };
    commitTime: number;
    lastPlacementChangeTime: number;
    stale: boolean;
    fadeDuration: number;
    retainedQueryData: {[number]: RetainedQueryData};
    collisionGroups: CollisionGroups;
    prevPlacement: ?Placement;

    constructor(transform: Transform, fadeDuration: number, crossSourceCollisions: boolean, prevPlacement?: Placement) {
        this.transform = transform.clone();
        this.collisionIndex = new CollisionIndex(this.transform);
        this.placements = {};
        this.opacities = {};
        this.variableOffsets = {};
        this.stale = false;
        this.commitTime = 0;
        this.fadeDuration = fadeDuration;
        this.retainedQueryData = {};
        this.collisionGroups = new CollisionGroups(crossSourceCollisions);

        this.prevPlacement = prevPlacement;
        if (prevPlacement) {
            prevPlacement.prevPlacement = undefined; // Only hold on to one placement back
        }

        this.placedOrientations = {};
    }

    placeLayerTile(styleLayer: StyleLayer, tile: Tile, showCollisionBoxes: boolean, seenCrossTileIDs: { [string | number]: boolean }) {
        const symbolBucket = ((tile.getBucket(styleLayer): any): SymbolBucket);
        const bucketFeatureIndex = tile.latestFeatureIndex;
        if (!symbolBucket || !bucketFeatureIndex || styleLayer.id !== symbolBucket.layerIds[0])
            return;

        const collisionBoxArray = tile.collisionBoxArray;

        const layout = symbolBucket.layers[0].layout;

        const scale = Math.pow(2, this.transform.zoom - tile.tileID.overscaledZ);
        const textPixelRatio = tile.tileSize / EXTENT;

        const posMatrix = this.transform.calculatePosMatrix(tile.tileID.toUnwrapped());

        const textLabelPlaneMatrix = projection.getLabelPlaneMatrix(posMatrix,
                layout.get('text-pitch-alignment') === 'map',
                layout.get('text-rotation-alignment') === 'map',
                this.transform,
                pixelsToTileUnits(tile, 1, this.transform.zoom));

        const iconLabelPlaneMatrix = projection.getLabelPlaneMatrix(posMatrix,
                layout.get('icon-pitch-alignment') === 'map',
                layout.get('icon-rotation-alignment') === 'map',
                this.transform,
                pixelsToTileUnits(tile, 1, this.transform.zoom));

        // As long as this placement lives, we have to hold onto this bucket's
        // matching FeatureIndex/data for querying purposes
        this.retainedQueryData[symbolBucket.bucketInstanceId] = new RetainedQueryData(
            symbolBucket.bucketInstanceId,
            bucketFeatureIndex,
            symbolBucket.sourceLayerIndex,
            symbolBucket.index,
            tile.tileID
        );
        this.placeLayerBucket(symbolBucket, posMatrix, textLabelPlaneMatrix, iconLabelPlaneMatrix, scale, textPixelRatio,
                showCollisionBoxes, tile.holdingForFade(), seenCrossTileIDs, collisionBoxArray);
    }

    attemptAnchorPlacement(anchor: TextAnchor, textBox: SingleCollisionBox, width: number, height: number,
                           textBoxScale: number, rotateWithMap: boolean,
                           pitchWithMap: boolean, textPixelRatio: number, posMatrix: mat4, collisionGroup: CollisionGroup,
                           textAllowOverlap: boolean, symbolInstance: SymbolInstance, bucket: SymbolBucket, orientation: number): ?{ shift: Point, placedGlyphBoxes: { box: Array<number>, offscreen: boolean } }  {

        const textOffset = [symbolInstance.textOffset0, symbolInstance.textOffset1];
        const shift = calculateVariableLayoutShift(anchor, width, height, textOffset, textBoxScale);

        const placedGlyphBoxes = this.collisionIndex.placeCollisionBox(
            shiftVariableCollisionBox(
                textBox, shift.x, shift.y,
                rotateWithMap, pitchWithMap, this.transform.angle),
            textAllowOverlap, textPixelRatio, posMatrix, collisionGroup.predicate);

        if (placedGlyphBoxes.box.length > 0) {
            let prevAnchor;
            // If this label was placed in the previous placement, record the anchor position
            // to allow us to animate the transition
            if (this.prevPlacement &&
                this.prevPlacement.variableOffsets[symbolInstance.crossTileID] &&
                this.prevPlacement.placements[symbolInstance.crossTileID] &&
                this.prevPlacement.placements[symbolInstance.crossTileID].text) {
                prevAnchor = this.prevPlacement.variableOffsets[symbolInstance.crossTileID].anchor;
            }
            assert(symbolInstance.crossTileID !== 0);
            this.variableOffsets[symbolInstance.crossTileID] = {
                textOffset,
                width,
                height,
                anchor,
                textBoxScale,
                prevAnchor
            };
            this.markUsedJustification(bucket, anchor, symbolInstance, orientation);

            if (bucket.allowVerticalPlacement) {
                this.markUsedOrientation(bucket, orientation, symbolInstance);
                this.placedOrientations[symbolInstance.crossTileID] = orientation;
            }

            return {shift, placedGlyphBoxes};
        }
    }

    placeLayerBucket(bucket: SymbolBucket, posMatrix: mat4, textLabelPlaneMatrix: mat4, iconLabelPlaneMatrix: mat4,
            scale: number, textPixelRatio: number, showCollisionBoxes: boolean, holdingForFade: boolean, seenCrossTileIDs: { [string | number]: boolean },
            collisionBoxArray: ?CollisionBoxArray) {
        const layout = bucket.layers[0].layout;
        const partiallyEvaluatedTextSize = symbolSize.evaluateSizeForZoom(bucket.textSizeData, this.transform.zoom);
        const textOptional = layout.get('text-optional');
        const iconOptional = layout.get('icon-optional');
        const textAllowOverlap = layout.get('text-allow-overlap');
        const iconAllowOverlap = layout.get('icon-allow-overlap');
        // This logic is similar to the "defaultOpacityState" logic below in updateBucketOpacities
        // If we know a symbol is always supposed to show, force it to be marked visible even if
        // it wasn't placed into the collision index (because some or all of it was outside the range
        // of the collision grid).
        // There is a subtle edge case here we're accepting:
        //  Symbol A has text-allow-overlap: true, icon-allow-overlap: true, icon-optional: false
        //  A's icon is outside the grid, so doesn't get placed
        //  A's text would be inside grid, but doesn't get placed because of icon-optional: false
        //  We still show A because of the allow-overlap settings.
        //  Symbol B has allow-overlap: false, and gets placed where A's text would be
        //  On panning in, there is a short period when Symbol B and Symbol A will overlap
        //  This is the reverse of our normal policy of "fade in on pan", but should look like any other
        //  collision and hopefully not be too noticeable.
        // See https://github.com/mapbox/mapbox-gl-js/issues/7172
        const alwaysShowText = textAllowOverlap && (iconAllowOverlap || !bucket.hasIconData() || iconOptional);
        const alwaysShowIcon = iconAllowOverlap && (textAllowOverlap || !bucket.hasTextData() || textOptional);

        const collisionGroup = this.collisionGroups.get(bucket.sourceID);

        const rotateWithMap = layout.get('text-rotation-alignment') === 'map';
        const pitchWithMap = layout.get('text-pitch-alignment') === 'map';
        const hasIconTextFit = layout.get('icon-text-fit') !== 'none';
        const zOrderByViewportY = layout.get('symbol-z-order') === 'viewport-y';

        if (!bucket.collisionArrays && collisionBoxArray) {
            bucket.deserializeCollisionBoxes(collisionBoxArray);
        }

        const placeSymbol = (symbolInstance: SymbolInstance, collisionArrays: CollisionArrays) => {
            if (seenCrossTileIDs[symbolInstance.crossTileID]) return;
            if (holdingForFade) {
                // Mark all symbols from this tile as "not placed", but don't add to seenCrossTileIDs, because we don't
                // know yet if we have a duplicate in a parent tile that _should_ be placed.
                this.placements[symbolInstance.crossTileID] = new JointPlacement(false, false, false);
                return;
            }

            let placeText = false;
            let placeIcon = false;
            let offscreen = true;
            let shift = null;

            let placed = {box: null, offscreen: null};
            let placedVertical = {box: null, offscreen: null};

            let placedGlyphBoxes = null;
            let placedGlyphCircles = null;
            let placedIconBoxes = null;
            let textFeatureIndex = 0;
            let verticalTextFeatureIndex = 0;
            let iconFeatureIndex = 0;

            if (collisionArrays.textFeatureIndex) {
                textFeatureIndex = collisionArrays.textFeatureIndex;
            }
            if (collisionArrays.verticalTextFeatureIndex) {
                verticalTextFeatureIndex = collisionArrays.verticalTextFeatureIndex;
            }

            const textBox = collisionArrays.textBox;
            if (textBox) {

                const updatePreviousOrientationIfNotPlaced = (isPlaced) => {
                    let previousOrientation = WritingMode.horizontal;
                    if (bucket.allowVerticalPlacement && !isPlaced && this.prevPlacement) {
                        const prevPlacedOrientation = this.prevPlacement.placedOrientations[symbolInstance.crossTileID];
                        if (prevPlacedOrientation) {
                            this.placedOrientations[symbolInstance.crossTileID] = prevPlacedOrientation;
                            previousOrientation = prevPlacedOrientation;
                            this.markUsedOrientation(bucket, previousOrientation, symbolInstance);
                        }
                    }
                    return previousOrientation;
                };

                const placeTextForPlacementModes = (placeHorizontalFn, placeVerticalFn) => {
                    if (bucket.allowVerticalPlacement && symbolInstance.numVerticalGlyphVertices > 0 && collisionArrays.verticalTextBox) {
                        for (const placementMode of bucket.writingModes) {
                            if (placementMode === WritingMode.vertical) {
                                placed = placeVerticalFn();
                                placedVertical = placed;
                            } else {
                                placed = placeHorizontalFn();
                            }
                            if (placed && placed.box && placed.box.length) break;
                        }
                    } else {
                        placed = placeHorizontalFn();
                    }
                };

                if (!layout.get('text-variable-anchor')) {
                    const placeBox = (collisionTextBox, orientation) => {
                        const placedFeature = this.collisionIndex.placeCollisionBox(collisionTextBox, layout.get('text-allow-overlap'),
                                                                                  textPixelRatio, posMatrix, collisionGroup.predicate);
                        if (placedFeature && placedFeature.box && placedFeature.box.length) {
                            this.markUsedOrientation(bucket, orientation, symbolInstance);
                            this.placedOrientations[symbolInstance.crossTileID] = orientation;
                        }
                        return placedFeature;
                    };

                    const placeHorizontal = () => {
                        return placeBox(textBox, WritingMode.horizontal);
                    };

                    const placeVertical = () => {
                        const verticalTextBox = collisionArrays.verticalTextBox;
                        if (bucket.allowVerticalPlacement && symbolInstance.numVerticalGlyphVertices > 0 && verticalTextBox) {
                            return placeBox(verticalTextBox, WritingMode.vertical);
                        }
                        return {box: null, offscreen: null};
                    };

                    placeTextForPlacementModes(placeHorizontal, placeVertical);
                    updatePreviousOrientationIfNotPlaced(placed && placed.box && placed.box.length);

                } else {
                    let anchors = layout.get('text-variable-anchor');

                    // If this symbol was in the last placement, shift the previously used
                    // anchor to the front of the anchor list, only if the previous anchor
                    // is still in the anchor list
                    if (this.prevPlacement && this.prevPlacement.variableOffsets[symbolInstance.crossTileID]) {
                        const prevOffsets = this.prevPlacement.variableOffsets[symbolInstance.crossTileID];
                        if (anchors.indexOf(prevOffsets.anchor) > 0) {
                            anchors = anchors.filter(anchor => anchor !== prevOffsets.anchor);
                            anchors.unshift(prevOffsets.anchor);
                        }
                    }

                    const placeBoxForVariableAnchors = (collisionTextBox, orientation) => {
                        const width = collisionTextBox.x2 - collisionTextBox.x1;
                        const height = collisionTextBox.y2 - collisionTextBox.y1;
                        const textBoxScale = symbolInstance.textBoxScale;

                        let placedBox: ?{ box: Array<number>, offscreen: boolean }  = {box: [], offscreen: false};
                        const placementAttempts = textAllowOverlap ? anchors.length * 2 : anchors.length;
                        for (let i = 0; i < placementAttempts; ++i) {
                            const anchor = anchors[i % anchors.length];
                            const allowOverlap = (i >= anchors.length);
                            const result = this.attemptAnchorPlacement(
                                anchor, collisionTextBox, width, height,
                                textBoxScale, rotateWithMap, pitchWithMap, textPixelRatio, posMatrix,
                                collisionGroup, allowOverlap, symbolInstance, bucket, orientation);

                            if (result) {
                                placedBox = result.placedGlyphBoxes;
                                if (placedBox && placedBox.box && placedBox.box.length) {
                                    placeText = true;
                                    shift = result.shift;
                                    break;
                                }
                            }
                        }

                        return placedBox;
                    };

                    const placeHorizontal = () => {
                        return placeBoxForVariableAnchors(textBox, WritingMode.horizontal);
                    };

                    const placeVertical = () => {
                        const verticalTextBox = collisionArrays.verticalTextBox;
                        const wasPlaced = placed && placed.box && placed.box.length;
                        if (bucket.allowVerticalPlacement && !wasPlaced && symbolInstance.numVerticalGlyphVertices > 0 && verticalTextBox) {
                            return placeBoxForVariableAnchors(verticalTextBox, WritingMode.vertical);
                        }
                        return {box: null, offscreen: null};
                    };

                    placeTextForPlacementModes(placeHorizontal, placeVertical);

                    if (placed) {
                        placeText = placed.box;
                        offscreen = placed.offscreen;
                    }

                    const prevOrientation = updatePreviousOrientationIfNotPlaced(placed && placed.box);

                    // If we didn't get placed, we still need to copy our position from the last placement for
                    // fade animations
                    if (!placeText && this.prevPlacement) {
                        const prevOffset = this.prevPlacement.variableOffsets[symbolInstance.crossTileID];
                        if (prevOffset) {
                            this.variableOffsets[symbolInstance.crossTileID] = prevOffset;
                            this.markUsedJustification(bucket, prevOffset.anchor, symbolInstance, prevOrientation);
                        }
                    }

                }
            }

            placedGlyphBoxes = placed;
            placeText = placedGlyphBoxes && placedGlyphBoxes.box && placedGlyphBoxes.box.length > 0;

            offscreen = placedGlyphBoxes && placedGlyphBoxes.offscreen;
            const textCircles = collisionArrays.textCircles;
            if (textCircles) {
                const placedSymbol = bucket.text.placedSymbolArray.get(symbolInstance.centerJustifiedTextSymbolIndex);
                const fontSize = symbolSize.evaluateSizeForFeature(bucket.textSizeData, partiallyEvaluatedTextSize, placedSymbol);
                placedGlyphCircles = this.collisionIndex.placeCollisionCircles(textCircles,
                        layout.get('text-allow-overlap'),
                        scale,
                        textPixelRatio,
                        placedSymbol,
                        bucket.lineVertexArray,
                        bucket.glyphOffsetArray,
                        fontSize,
                        posMatrix,
                        textLabelPlaneMatrix,
                        showCollisionBoxes,
                        pitchWithMap,
                        collisionGroup.predicate);
                // If text-allow-overlap is set, force "placedCircles" to true
                // In theory there should always be at least one circle placed
                // in this case, but for now quirks in text-anchor
                // and text-offset may prevent that from being true.
                placeText = layout.get('text-allow-overlap') || placedGlyphCircles.circles.length > 0;
                offscreen = offscreen && placedGlyphCircles.offscreen;
            }

            if (collisionArrays.iconFeatureIndex) {
                iconFeatureIndex = collisionArrays.iconFeatureIndex;
            }
            if (collisionArrays.iconBox) {

                const iconBox = hasIconTextFit && shift ?
                    shiftVariableCollisionBox(
                        collisionArrays.iconBox, shift.x, shift.y,
                        rotateWithMap, pitchWithMap, this.transform.angle) :
                    collisionArrays.iconBox;

                placedIconBoxes = this.collisionIndex.placeCollisionBox(iconBox,
                        layout.get('icon-allow-overlap'), textPixelRatio, posMatrix, collisionGroup.predicate);
                placeIcon = placedIconBoxes.box.length > 0;
                offscreen = offscreen && placedIconBoxes.offscreen;
            }

            const iconWithoutText = textOptional ||
                (symbolInstance.numHorizontalGlyphVertices === 0 && symbolInstance.numVerticalGlyphVertices === 0);
            const textWithoutIcon = iconOptional || symbolInstance.numIconVertices === 0;

            // Combine the scales for icons and text.
            if (!iconWithoutText && !textWithoutIcon) {
                placeIcon = placeText = placeIcon && placeText;
            } else if (!textWithoutIcon) {
                placeText = placeIcon && placeText;
            } else if (!iconWithoutText) {
                placeIcon = placeIcon && placeText;
            }

            if (placeText && placedGlyphBoxes && placedGlyphBoxes.box) {
                if (placedVertical && placedVertical.box && verticalTextFeatureIndex) {
                    this.collisionIndex.insertCollisionBox(placedGlyphBoxes.box, layout.get('text-ignore-placement'),
                        bucket.bucketInstanceId, verticalTextFeatureIndex, collisionGroup.ID);
                } else {
                    this.collisionIndex.insertCollisionBox(placedGlyphBoxes.box, layout.get('text-ignore-placement'),
                        bucket.bucketInstanceId, textFeatureIndex, collisionGroup.ID);
                }

            }
            if (placeIcon && placedIconBoxes) {
                this.collisionIndex.insertCollisionBox(placedIconBoxes.box, layout.get('icon-ignore-placement'),
                        bucket.bucketInstanceId, iconFeatureIndex, collisionGroup.ID);
            }
            if (placeText && placedGlyphCircles) {
                this.collisionIndex.insertCollisionCircles(placedGlyphCircles.circles, layout.get('text-ignore-placement'),
                        bucket.bucketInstanceId, textFeatureIndex, collisionGroup.ID);
            }

            assert(symbolInstance.crossTileID !== 0);
            assert(bucket.bucketInstanceId !== 0);

            this.placements[symbolInstance.crossTileID] = new JointPlacement(placeText || alwaysShowText, placeIcon || alwaysShowIcon, offscreen || bucket.justReloaded);
            seenCrossTileIDs[symbolInstance.crossTileID] = true;
        };

        if (zOrderByViewportY) {
            const symbolIndexes = bucket.getSortedSymbolIndexes(this.transform.angle);
            for (let i = symbolIndexes.length - 1; i >= 0; --i) {
                const symbolIndex = symbolIndexes[i];
                placeSymbol(bucket.symbolInstances.get(symbolIndex), bucket.collisionArrays[symbolIndex]);
            }
        } else {
            for (let i = 0; i < bucket.symbolInstances.length; ++i) {
                placeSymbol(bucket.symbolInstances.get(i), bucket.collisionArrays[i]);
            }
        }

        bucket.justReloaded = false;
    }

    markUsedJustification(bucket: SymbolBucket, placedAnchor: TextAnchor, symbolInstance: SymbolInstance, orientation: number) {
        const justifications = {
            "left": symbolInstance.leftJustifiedTextSymbolIndex,
            "center": symbolInstance.centerJustifiedTextSymbolIndex,
            "right": symbolInstance.rightJustifiedTextSymbolIndex
        };

        let autoIndex;
        if (orientation === WritingMode.vertical) {
            autoIndex = symbolInstance.verticalPlacedTextSymbolIndex;
        } else {
            autoIndex = justifications[getAnchorJustification(placedAnchor)];
        }

        const indexes = [
            symbolInstance.leftJustifiedTextSymbolIndex,
            symbolInstance.centerJustifiedTextSymbolIndex,
            symbolInstance.rightJustifiedTextSymbolIndex,
            symbolInstance.verticalPlacedTextSymbolIndex
        ];

        for (const index of indexes) {
            if (index >= 0) {
                if (autoIndex >= 0 && index !== autoIndex) {
                    // There are multiple justifications and this one isn't it: shift offscreen
                    bucket.text.placedSymbolArray.get(index).crossTileID = 0;
                } else {
                    // Either this is the chosen justification or the justification is hardwired: use this one
                    bucket.text.placedSymbolArray.get(index).crossTileID = symbolInstance.crossTileID;
                }
            }
        }
    }

    markUsedOrientation(bucket: SymbolBucket, orientation: number, symbolInstance: SymbolInstance) {
        const horizontal = (orientation === WritingMode.horizontal || orientation === WritingMode.horizontalOnly) ? orientation : 0;
        const vertical = orientation === WritingMode.vertical ? orientation : 0;

        const horizontalIndexes = [
            symbolInstance.leftJustifiedTextSymbolIndex,
            symbolInstance.centerJustifiedTextSymbolIndex,
            symbolInstance.rightJustifiedTextSymbolIndex
        ];

        for (const index of horizontalIndexes) {
            bucket.text.placedSymbolArray.get(index).placedOrientation = horizontal;
        }

        if (symbolInstance.verticalPlacedTextSymbolIndex) {
            bucket.text.placedSymbolArray.get(symbolInstance.verticalPlacedTextSymbolIndex).placedOrientation = vertical;
        }
    }

    commit(now: number): void {
        this.commitTime = now;

        const prevPlacement = this.prevPlacement;
        let placementChanged = false;

        const increment = (prevPlacement && this.fadeDuration !== 0) ?
            (this.commitTime - prevPlacement.commitTime) / this.fadeDuration :
            1;

        const prevOpacities = prevPlacement ? prevPlacement.opacities : {};
        const prevOffsets = prevPlacement ? prevPlacement.variableOffsets : {};
        const prevOrientations = prevPlacement ? prevPlacement.placedOrientations : {};

        // add the opacities from the current placement, and copy their current values from the previous placement
        for (const crossTileID in this.placements) {
            const jointPlacement = this.placements[crossTileID];
            const prevOpacity = prevOpacities[crossTileID];
            if (prevOpacity) {
                this.opacities[crossTileID] = new JointOpacityState(prevOpacity, increment, jointPlacement.text, jointPlacement.icon);
                placementChanged = placementChanged ||
                    jointPlacement.text !== prevOpacity.text.placed ||
                    jointPlacement.icon !== prevOpacity.icon.placed;
            } else {
                this.opacities[crossTileID] = new JointOpacityState(null, increment, jointPlacement.text, jointPlacement.icon, jointPlacement.skipFade);
                placementChanged = placementChanged || jointPlacement.text || jointPlacement.icon;
            }
        }

        // copy and update values from the previous placement that aren't in the current placement but haven't finished fading
        for (const crossTileID in prevOpacities) {
            const prevOpacity = prevOpacities[crossTileID];
            if (!this.opacities[crossTileID]) {
                const jointOpacity = new JointOpacityState(prevOpacity, increment, false, false);
                if (!jointOpacity.isHidden()) {
                    this.opacities[crossTileID] = jointOpacity;
                    placementChanged = placementChanged || prevOpacity.text.placed || prevOpacity.icon.placed;
                }
            }
        }
        for (const crossTileID in prevOffsets) {
            if (!this.variableOffsets[crossTileID] && this.opacities[crossTileID] && !this.opacities[crossTileID].isHidden()) {
                this.variableOffsets[crossTileID] = prevOffsets[crossTileID];
            }
        }

        for (const crossTileID in prevOrientations) {
            if (!this.placedOrientations[crossTileID] && this.opacities[crossTileID] && !this.opacities[crossTileID].isHidden()) {
                this.placedOrientations[crossTileID] = prevOrientations[crossTileID];
            }
        }

        // this.lastPlacementChangeTime is the time of the last commit() that
        // resulted in a placement change -- in other words, the start time of
        // the last symbol fade animation
        assert(!prevPlacement || prevPlacement.lastPlacementChangeTime !== undefined);
        if (placementChanged) {
            this.lastPlacementChangeTime = now;
        } else if (typeof this.lastPlacementChangeTime !== 'number') {
            this.lastPlacementChangeTime = prevPlacement ? prevPlacement.lastPlacementChangeTime : now;
        }
    }

    updateLayerOpacities(styleLayer: StyleLayer, tiles: Array<Tile>) {
        const seenCrossTileIDs = {};
        for (const tile of tiles) {
            const symbolBucket = ((tile.getBucket(styleLayer): any): SymbolBucket);
            if (symbolBucket && tile.latestFeatureIndex && styleLayer.id === symbolBucket.layerIds[0]) {
                this.updateBucketOpacities(symbolBucket, seenCrossTileIDs, tile.collisionBoxArray);
            }
        }
    }

    updateBucketOpacities(bucket: SymbolBucket, seenCrossTileIDs: { [string | number]: boolean }, collisionBoxArray: ?CollisionBoxArray) {
        if (bucket.hasTextData()) bucket.text.opacityVertexArray.clear();
        if (bucket.hasIconData()) bucket.icon.opacityVertexArray.clear();
        if (bucket.hasIconCollisionBoxData()) bucket.iconCollisionBox.collisionVertexArray.clear();
        if (bucket.hasTextCollisionBoxData()) bucket.textCollisionBox.collisionVertexArray.clear();
        if (bucket.hasIconCollisionCircleData()) bucket.iconCollisionCircle.collisionVertexArray.clear();
        if (bucket.hasTextCollisionCircleData()) bucket.textCollisionCircle.collisionVertexArray.clear();

        const layout = bucket.layers[0].layout;
        const duplicateOpacityState = new JointOpacityState(null, 0, false, false, true);
        const textAllowOverlap = layout.get('text-allow-overlap');
        const iconAllowOverlap = layout.get('icon-allow-overlap');
        const variablePlacement = layout.get('text-variable-anchor');
        const rotateWithMap = layout.get('text-rotation-alignment') === 'map';
        const pitchWithMap = layout.get('text-pitch-alignment') === 'map';
        const hasIconTextFit = layout.get('icon-text-fit') !== 'none';
        // If allow-overlap is true, we can show symbols before placement runs on them
        // But we have to wait for placement if we potentially depend on a paired icon/text
        // with allow-overlap: false.
        // See https://github.com/mapbox/mapbox-gl-js/issues/7032
        const defaultOpacityState = new JointOpacityState(null, 0,
                textAllowOverlap && (iconAllowOverlap || !bucket.hasIconData() || layout.get('icon-optional')),
                iconAllowOverlap && (textAllowOverlap || !bucket.hasTextData() || layout.get('text-optional')),
                true);

        if (!bucket.collisionArrays && collisionBoxArray && ((bucket.hasIconCollisionBoxData() || bucket.hasIconCollisionCircleData() ||
            bucket.hasTextCollisionBoxData() || bucket.hasTextCollisionCircleData()))) {
            bucket.deserializeCollisionBoxes(collisionBoxArray);
        }

        for (let s = 0; s < bucket.symbolInstances.length; s++) {
            const symbolInstance = bucket.symbolInstances.get(s);
            const {
                numHorizontalGlyphVertices,
                numVerticalGlyphVertices,
                crossTileID
            } = symbolInstance;

            const isDuplicate = seenCrossTileIDs[crossTileID];

            let opacityState = this.opacities[crossTileID];
            if (isDuplicate) {
                opacityState = duplicateOpacityState;
            } else if (!opacityState) {
                opacityState = defaultOpacityState;
                // store the state so that future placements use it as a starting point
                this.opacities[crossTileID] = opacityState;
            }

            seenCrossTileIDs[crossTileID] = true;

            const hasText = numHorizontalGlyphVertices > 0 || numVerticalGlyphVertices > 0;
            const hasIcon = symbolInstance.numIconVertices > 0;

            if (hasText) {
                const packedOpacity = packOpacity(opacityState.text);
                // Vertical text fades in/out on collision the same way as corresponding
                // horizontal text. Switch between vertical/horizontal should be instantaneous
                const opacityEntryCount = (numHorizontalGlyphVertices + numVerticalGlyphVertices) / 4;
                for (let i = 0; i < opacityEntryCount; i++) {
                    bucket.text.opacityVertexArray.emplaceBack(packedOpacity);
                }
                // If this label is completely faded, mark it so that we don't have to calculate
                // its position at render time. If this layer has variable placement, shift the various
                // symbol instances appropriately so that symbols from buckets that have yet to be placed
                // offset appropriately.
                const symbolHidden = opacityState.text.isHidden() ? 1 : 0;
                const placedOrientation = this.placedOrientations[symbolInstance.crossTileID];
                const verticalHidden = (placedOrientation === WritingMode.horizontal || placedOrientation === WritingMode.horizontalOnly) ? 1 : 0;
                const horizontalHidden = placedOrientation === WritingMode.vertical ? 1 : 0;
                [
                    symbolInstance.rightJustifiedTextSymbolIndex,
                    symbolInstance.centerJustifiedTextSymbolIndex,
                    symbolInstance.leftJustifiedTextSymbolIndex
                ].forEach(index => {
                    if (index >= 0) {
                        bucket.text.placedSymbolArray.get(index).hidden = symbolHidden || horizontalHidden;
                    }
                });

                if (symbolInstance.verticalPlacedTextSymbolIndex >= 0) {
                    bucket.text.placedSymbolArray.get(symbolInstance.verticalPlacedTextSymbolIndex).hidden = symbolHidden || verticalHidden;
                }

                const prevOffset = this.variableOffsets[symbolInstance.crossTileID];
                if (prevOffset) {
                    this.markUsedJustification(bucket, prevOffset.anchor, symbolInstance, placedOrientation);
                }

                const prevOrientation = this.placedOrientations[symbolInstance.crossTileID];
                if (prevOrientation) {
                    this.markUsedJustification(bucket, 'left', symbolInstance, prevOrientation);
                    this.markUsedOrientation(bucket, prevOrientation, symbolInstance);
                }
            }

            if (hasIcon) {
                const packedOpacity = packOpacity(opacityState.icon);
                for (let i = 0; i < symbolInstance.numIconVertices / 4; i++) {
                    bucket.icon.opacityVertexArray.emplaceBack(packedOpacity);
                }
                bucket.icon.placedSymbolArray.get(s).hidden =
                    (opacityState.icon.isHidden(): any);
            }

            if (bucket.hasIconCollisionBoxData() || bucket.hasIconCollisionCircleData() ||
                bucket.hasTextCollisionBoxData() || bucket.hasTextCollisionCircleData()) {
                const collisionArrays = bucket.collisionArrays[s];
                if (collisionArrays) {
                    let shift = new Point(0, 0);
                    if (collisionArrays.textBox) {
                        let used = true;
                        if (variablePlacement) {
                            const variableOffset = this.variableOffsets[crossTileID];
                            if (variableOffset) {
                                // This will show either the currently placed position or the last
                                // successfully placed position (so you can visualize what collision
                                // just made the symbol disappear, and the most likely place for the
                                // symbol to come back)
                                shift = calculateVariableLayoutShift(variableOffset.anchor,
                                   variableOffset.width,
                                   variableOffset.height,
                                   variableOffset.textOffset,
                                   variableOffset.textBoxScale);
                                if (rotateWithMap) {
                                    shift._rotate(pitchWithMap ? this.transform.angle : -this.transform.angle);
                                }
                            } else {
                                // No offset -> this symbol hasn't been placed since coming on-screen
                                // No single box is particularly meaningful and all of them would be too noisy
                                // Use the center box just to show something's there, but mark it "not used"
                                used = false;
                            }
                        }

                        updateCollisionVertices(bucket.textCollisionBox.collisionVertexArray, opacityState.text.placed, !used, shift.x, shift.y);
                    }

                    if (collisionArrays.iconBox) {
                        updateCollisionVertices(bucket.iconCollisionBox.collisionVertexArray, opacityState.icon.placed, false,
                            hasIconTextFit ? shift.x : 0,
                            hasIconTextFit ? shift.y : 0);
                    }

                    const textCircles = collisionArrays.textCircles;
                    if (textCircles && bucket.hasTextCollisionCircleData()) {
                        for (let k = 0; k < textCircles.length; k += 5) {
                            const notUsed = isDuplicate || textCircles[k + 4] === 0;
                            updateCollisionVertices(bucket.textCollisionCircle.collisionVertexArray, opacityState.text.placed, notUsed);
                        }
                    }
                }
            }
        }

        bucket.sortFeatures(this.transform.angle);
        if (this.retainedQueryData[bucket.bucketInstanceId]) {
            this.retainedQueryData[bucket.bucketInstanceId].featureSortOrder = bucket.featureSortOrder;
        }

        if (bucket.hasTextData() && bucket.text.opacityVertexBuffer) {
            bucket.text.opacityVertexBuffer.updateData(bucket.text.opacityVertexArray);
        }
        if (bucket.hasIconData() && bucket.icon.opacityVertexBuffer) {
            bucket.icon.opacityVertexBuffer.updateData(bucket.icon.opacityVertexArray);
        }
        if (bucket.hasIconCollisionBoxData() && bucket.iconCollisionBox.collisionVertexBuffer) {
            bucket.iconCollisionBox.collisionVertexBuffer.updateData(bucket.iconCollisionBox.collisionVertexArray);
        }
        if (bucket.hasTextCollisionBoxData() && bucket.textCollisionBox.collisionVertexBuffer) {
            bucket.textCollisionBox.collisionVertexBuffer.updateData(bucket.textCollisionBox.collisionVertexArray);
        }
        if (bucket.hasIconCollisionCircleData() && bucket.iconCollisionCircle.collisionVertexBuffer) {
            bucket.iconCollisionCircle.collisionVertexBuffer.updateData(bucket.iconCollisionCircle.collisionVertexArray);
        }
        if (bucket.hasTextCollisionCircleData() && bucket.textCollisionCircle.collisionVertexBuffer) {
            bucket.textCollisionCircle.collisionVertexBuffer.updateData(bucket.textCollisionCircle.collisionVertexArray);
        }

        assert(bucket.text.opacityVertexArray.length === bucket.text.layoutVertexArray.length / 4);
        assert(bucket.icon.opacityVertexArray.length === bucket.icon.layoutVertexArray.length / 4);
    }

    symbolFadeChange(now: number) {
        return this.fadeDuration === 0 ?
            1 :
            (now - this.commitTime) / this.fadeDuration;
    }

    hasTransitions(now: number) {
        return this.stale ||
            now - this.lastPlacementChangeTime < this.fadeDuration;
    }

    stillRecent(now: number) {
        return this.commitTime + this.fadeDuration > now;
    }

    setStale() {
        this.stale = true;
    }
}

function updateCollisionVertices(collisionVertexArray: CollisionVertexArray, placed: boolean, notUsed: boolean, shiftX?: number, shiftY?: number) {
    collisionVertexArray.emplaceBack(placed ? 1 : 0, notUsed ? 1 : 0, shiftX || 0, shiftY || 0);
    collisionVertexArray.emplaceBack(placed ? 1 : 0, notUsed ? 1 : 0, shiftX || 0, shiftY || 0);
    collisionVertexArray.emplaceBack(placed ? 1 : 0, notUsed ? 1 : 0, shiftX || 0, shiftY || 0);
    collisionVertexArray.emplaceBack(placed ? 1 : 0, notUsed ? 1 : 0, shiftX || 0, shiftY || 0);
}

// All four vertices for a glyph will have the same opacity state
// So we pack the opacity into a uint8, and then repeat it four times
// to make a single uint32 that we can upload for each glyph in the
// label.
const shift25 = Math.pow(2, 25);
const shift24 = Math.pow(2, 24);
const shift17 = Math.pow(2, 17);
const shift16 = Math.pow(2, 16);
const shift9 = Math.pow(2, 9);
const shift8 = Math.pow(2, 8);
const shift1 = Math.pow(2, 1);
function packOpacity(opacityState: OpacityState): number {
    if (opacityState.opacity === 0 && !opacityState.placed) {
        return 0;
    } else if (opacityState.opacity === 1 && opacityState.placed) {
        return 4294967295;
    }
    const targetBit = opacityState.placed ? 1 : 0;
    const opacityBits = Math.floor(opacityState.opacity * 127);
    return opacityBits * shift25 + targetBit * shift24 +
        opacityBits * shift17 + targetBit * shift16 +
        opacityBits * shift9 + targetBit * shift8 +
        opacityBits * shift1 + targetBit;
}
