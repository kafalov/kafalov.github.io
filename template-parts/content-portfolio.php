<?php
/**
 * Template part for displaying posts
 *
 * @link https://developer.wordpress.org/themes/basics/template-hierarchy/
 *
 * @package vcard
 */

?>

<?php

/* post content */
$current_categories = get_the_terms( get_the_ID(), 'portfolio_categories' );
$category = '';
$category_slug = '';
if ( $current_categories && ! is_wp_error( $current_categories ) ) {
	$arr_keys = array_keys( $current_categories );
	$last_key = end( $arr_keys );
	foreach ( $current_categories as $key => $value ) {
		if ( $key == $last_key ) {
			$category .= $value->name . ' ';
		} else {
			$category .= $value->name . ', ';
		}
		$category_slug = 'category-' . $value->slug;
	}
}
$id = get_the_ID();
$title = get_the_title();
$href = get_the_permalink();

$theme_lightbox = get_field( 'portfolio_lightbox_disable', 'option' );


/*get portfolio type*/
$type = get_field( 'portfolio_type', $id );
$popup_url = get_the_post_thumbnail_url( $id, 'full' );
$popup_class = 'has-popup-image';
$preview_icon = 'fas fa-eye';
$images = false;
$popup_link_target = false;
$lightbox_atts = 0;

if ( $type == 2 ) {
	$popup_url = get_field( 'music_url', $id );
	$popup_class = 'has-popup-music';
	$preview_icon = 'fas fa-music';
} elseif ( $type == 3 ) {
	$popup_url = get_field( 'video_url', $id );
	$popup_class = 'has-popup-video';
	$preview_icon = 'fas fa-video-camera';
} elseif ( $type == 4 ) {
	$popup_url = $href;
	$popup_class = 'has-popup-content';
	$preview_icon = 'fa fa-plus';
} elseif ( $type == 5 ) {
	$popup_url = '#gallery-' . $id;
	$popup_class = 'has-popup-gallery';
	$preview_icon = 'fas fa-eye';
	$images = get_field( 'gallery', $id );
} elseif ( $type == 6 ) {
	$popup_url = get_field( 'link_url', $id );
	$popup_link_target = true;
	$popup_class = 'has-popup-link';
	$preview_icon = 'fa fa-link';
} else {
	if ( $theme_lightbox == 1 ) {
		$popup_class = 'has-popup-elementor';
	}
	$lightbox_atts = 1;
}

$layout = get_query_var( 'layout' );
$show_item_details = get_query_var( 'show_item_details' );
$show_item_title = get_query_var( 'show_item_title' );
$show_item_category = get_query_var( 'show_item_category' );

if ( $layout == 'masonry' ) {
	$image = get_the_post_thumbnail_url( $id, 'vcard_900xAuto' );
} elseif ( $layout == 'horizontal' ) {
	$image = get_the_post_thumbnail_url( $id, 'vcard_900x675' );
} elseif ( $layout == 'vertical' ) {
	$image = get_the_post_thumbnail_url( $id, 'vcard_900x1200' );
} else {
	$image = get_the_post_thumbnail_url( $id, 'vcard_900x900' );
}

?>

<!-- Item -->
<figure class="gallery-grid__item <?php echo esc_attr( $category_slug ); ?>">
    <?php if ( $image ) : ?>
    <div class="gallery-grid__image-wrap">
        <a href="<?php echo esc_url( $popup_url ); ?>" class="<?php echo esc_attr( $popup_class ); ?>"<?php if ( $popup_link_target ) : ?> target="_blank"<?php endif; ?><?php if ( $lightbox_atts ) : ?> data-no-swup data-elementor-lightbox-slideshow="gallery" data-elementor-lightbox-title="<?php echo esc_attr( $title ); ?>"<?php endif; ?>>
        	<img class="gallery-grid__image cover lazyload" src="<?php echo esc_url( $image ); ?>" alt="<?php echo esc_attr( $title ); ?>" />
        	<i class="icon-hover <?php echo esc_attr( $preview_icon ); ?>"></i>
        </a>
        <?php if( $images ) : ?>
		<div id="gallery-<?php echo esc_attr( $id ); ?>" class="mfp-hide">
			<?php foreach( $images as $image ) : $gallery_img_src = wp_get_attachment_image_src( $image['ID'], 'full' ); ?>
			<a href="<?php echo esc_url( $gallery_img_src[0] ); ?>"></a>
			<?php endforeach; ?>
		</div>
		<?php endif; ?>
	</div>
	<?php endif; ?>
    
    <?php if ( $show_item_details == 'yes' ) : ?>
    <figcaption class="gallery-grid__caption">
    	<?php if ( $show_item_title == 'yes' ) : ?>
	    <h4 class="title gallery-grid__title">
	    	<a href="<?php echo esc_url( $href ); ?>"><?php echo esc_html( $title ); ?></a>
	    </h4>
	    <?php endif; ?>
	    <?php if ( $category && $show_item_category == 'yes' ) : ?>
		<span class="gallery-grid__category"><?php echo esc_html( $category ); ?></span>
		<?php endif; ?>
	</figcaption>
	<?php endif; ?>
</figure>