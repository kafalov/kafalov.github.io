<?php
/**
 * Template part for displaying side panel
 *
 * @link https://developer.wordpress.org/themes/basics/template-hierarchy/
 *
 * @package vcard
 */

?>

<!-- Sidebar -->
<aside class="col-12 col-md-12 col-xl-3">
    <?php

    $vcard_avatar = get_field( 'vcard_avatar', 'option' );
    $vcard_fname = get_field( 'vcard_fname', 'option' );
    $vcard_lname = get_field( 'vcard_lname', 'option' );
    $vcard_role = get_field( 'vcard_role', 'option' );
    $social_links = get_field( 'social_links', 'option' );
    $vcard_info = get_field( 'vcard_info', 'option' );
    $vcard_btn = get_field( 'vcard_btn', 'option' );
    $vcard_btn_text = get_field( 'vcard_btn_text', 'option' );
    $vcard_btn_url = get_field( 'vcard_btn_url', 'option' );

    $vcard = 0;
    if ( $vcard_fname || $vcard_lname ) : 
        $vcard = 1;
    endif;

    ?>
    <div class="sidebar box shadow pb-0<?php if ( $vcard ) : ?> sticky-column<?php endif;?>">
        <?php if ( $vcard ) : ?>
        <?php if ( $vcard_avatar ) : ?>
        <a href="<?php echo esc_url( home_url() ); ?>">
            <svg class="avatar avatar--180" viewBox="0 0 188 188">
                <g class="avatar__box">
                    <image xlink:href="<?php echo esc_url( $vcard_avatar ); ?>" height="100%" width="100%" />
                </g>
            </svg>
        </a>
        <?php endif; ?>

        <div class="text-center">
            <?php if ( $vcard_fname || $vcard_lname ) : ?>
            <h3 class="title title--h3 sidebar__user-name">
                <span class="weight--500"><?php echo esc_html( $vcard_fname ); ?></span> <?php echo esc_html( $vcard_lname ); ?>
            </h3>
            <?php endif; ?>
            <?php if ( $vcard_role ) : ?>
            <div class="badge badge--gray"><?php echo esc_html( $vcard_role ); ?></div>
            <?php endif; ?>

            <?php if ( $social_links ) : ?>
            <!-- Social -->
            <div class="social">
                <?php foreach ( $social_links as $link ) : ?>
                <a target="_blank" data-no-swup class="social__link" href="<?php echo esc_url( $link['url'] ); ?>" title="<?php echo esc_attr( $link['label'] ); ?>">
                    <i class="<?php echo esc_attr( $link['icon'] ); ?>"></i>
                </a>
                <?php endforeach; ?>
            </div>
            <?php endif; ?>
        </div>
        
        <div class="sidebar__info box-inner box-inner--rounded">
            <?php if ( $vcard_info ) : ?>
            <ul class="contacts-block">
                <?php foreach ( $vcard_info as $item ) : ?>
                <li class="contacts-block__item" data-toggle="tooltip" data-placement="top" title="<?php echo esc_attr( $item['label'] ); ?>">
                    <?php if ( $item['url'] ) : ?><a href="<?php echo esc_attr( $item['url'] ); ?>" target="_blank"><?php endif; ?>
                    <?php if ( $item['icon_type'] == 0 ) : ?>
                    <i class="<?php echo esc_attr( $item['icon'] ); ?>"></i>
                    <?php else : ?>
                    <i class="font-icon icon-<?php echo esc_attr( $item['icon_default'] ); ?>"></i>
                    <?php endif; ?>
                    <?php echo esc_html( $item['text'] ); ?>
                    <?php if ( $item['url'] ) : ?></a><?php endif; ?>
                </li>
                <?php endforeach; ?>
            </ul>
            <?php endif; ?>

            <?php if ( $vcard_btn ) : ?>
            <a class="btn" target="_blank" data-no-swup href="<?php echo esc_url( $vcard_btn_url ); ?>"><i class="font-icon icon-download"></i> <?php echo esc_html( $vcard_btn_text ); ?></a>
            <?php endif; ?>
        </div>
        <?php else :
            if ( is_active_sidebar( 'sidebar-1' ) ) :
                get_sidebar();
            endif;
        endif; ?>
    </div>  
</aside>