<?php
/**
 * Skin
**/
if ( function_exists( 'get_field' ) ) {
	/**
	 * Dark Version
	 */

	$theme_ui = get_field( 'theme_ui', 'option' );

	if ( $theme_ui == 0 ) {
		function vcard_dark_stylesheets() {
			wp_enqueue_style( 'vcard-dark', get_template_directory_uri() . '/assets/css/dark.css', '1.0' );
		}
		add_action( 'wp_enqueue_scripts', 'vcard_dark_stylesheets', 10 );

	}
}

function vcard_hexToRgb( $hex ) {
	$hex = str_replace( '#', '', $hex );
	$length = strlen( $hex );
	$rgb['r'] = hexdec( $length == 6 ? substr( $hex, 0, 2 ) : ( $length == 3 ? str_repeat( substr( $hex, 0, 1), 2) : 0 ) );
	$rgb['g'] = hexdec( $length == 6 ? substr( $hex, 2, 2 ) : ( $length == 3 ? str_repeat( substr( $hex, 1, 1), 2) : 0 ) );
	$rgb['b'] = hexdec( $length == 6 ? substr( $hex, 4, 2 ) : ( $length == 3 ? str_repeat( substr( $hex, 2, 1), 2) : 0 ) );
	
	return implode( ", ", $rgb );
}

function vcard_skin() {
	$theme_ui = get_field( 'theme_ui', 'option' );
	$bg_color = get_field( 'theme_bg_color', 'options' );
	$theme_color = get_field( 'theme_color', 'options' );
	$heading_color = get_field( 'heading_color', 'options' );
	$text_color = get_field( 'text_color', 'options' );
	$text_selected_color = get_field( 'text_selected_color', 'options' );
	$menu_font_color = get_field( 'menu_font_color', 'options' );
	
	$heading_font_family = get_field( 'heading_font_family', 'options' );
	$text_font_family = get_field( 'text_font_family', 'options' );
	$menu_font_family = get_field( 'menu_font_family', 'options' );

	$heading_font_size = get_field( 'heading_font_size', 'options' );
	$text_font_size = get_field( 'text_font_size', 'options' );
	$menu_font_size = get_field( 'menu_font_size', 'options' );
	
	if ( $theme_ui ) {
		$bg_color = get_field( 'theme_bg_light_color', 'options' );
		$heading_color = get_field( 'heading_light_color', 'options' );
		$text_color = get_field( 'text_light_color', 'options' );
		$menu_font_color = get_field( 'menu_font_light_color', 'options' );
	}
?>

<style>
	<?php if ( $text_selected_color ) : ?>
	::selection {
  		color: <?php echo esc_attr( $text_selected_color ); ?>;
	}
	::-moz-selection {
  		color: <?php echo esc_attr( $text_selected_color ); ?>;
	}
	<?php endif; ?>

	<?php if ( $bg_color ) : ?>
	/* BG Color */
	body, .input:focus, .textarea:focus, select:focus, .custom-select:focus, .preloader, .medium-zoom-overlay {
		background-color: <?php echo esc_attr( $bg_color ); ?>;
	}
	<?php endif; ?>

	<?php if ( $heading_color ) : ?>
	/* Heading Color */
	h1, h2, h3, h4, h5, h6, .pricing-item.content-box .name {
		color: <?php echo esc_attr( $heading_color ); ?>;
	}
	<?php endif; ?>

	<?php if ( $heading_font_size ) : ?>
	/* Heading Font Size */
	h1, h2 {
		font-size: <?php echo esc_attr( $heading_font_size ); ?>px;
	}
	<?php endif; ?>

	<?php if ( $text_color ) : ?>
	/* Text Color */
	body, .input, .textarea, select, .custom-select, input[type="text"], input[type="tel"], input[type="number"], input[type="password"], input[type="email"], input[type="search"], .input:focus, .textarea:focus, select:focus, .custom-select:focus, select option, .custom-select option, .dropdown-menu, .contacts-block__item a, .social__link, .case-item__caption, .popover-map-title, .popover-map-caption, .gallery-grid__title a, .news-item .title a, .news-item__date, .news-item p, .content-post p, .footer-post__share, .comment-box__body, .comment-box__details, .comment-form .icon-smile:hover, .review-item__caption, .content-sidebar .widget-title a, .content-sidebar ul li a, .single-post-text .wp-block-archives li a, .content-sidebar ul li a.rsswidget, .rssSummary, .tags-links a, .tagcloud a, .col__sedebar .tagcloud a, .wp-block-tag-cloud a, .archive-item .date a, .archive-item .name, .nav-links .nav-previous a, .nav-links .nav-next a, .comment-box__details a, .logo-text .logo-text__name, .logo-text .logo-text__sub, .error-page .description, .pricing-item.content-box .name {
		color: <?php echo esc_attr( $text_color ); ?>;
	}
	<?php endif; ?>

	<?php if ( $text_font_family ) : ?>
	/* Base Font Family */
	body, .tooltip, h1, h2, h3, h4, h5, h6, .pricing-item.content-box .name, .pricing-item.content-box .amount {
		font-family: '<?php echo esc_attr( $text_font_family['font_name'] ); ?>';
	}
	<?php endif; ?>

	<?php if ( $heading_font_family ) : ?>
	/* Primary Font Family */
	.sidebar__user-name, .news-item .title, .header-post .title, .review-item .title, .archive-item .name, .logo-text .logo-text__name {
		font-family: '<?php echo esc_attr( $heading_font_family['font_name'] ); ?>';
	}
	<?php endif; ?>

	<?php if ( $text_font_size ) : ?>
	/* Text Font Size */
	body, .dropdown-menu, .badge, .gallery-grid__title, .comment-box__body {
		font-size: <?php echo esc_attr( $text_font_size ); ?>px;
	}
	<?php endif; ?>

	<?php if ( $menu_font_color ) : ?>
	/* Menu Color */
	.nav > .nav__item > a {
		color: <?php echo esc_attr( $menu_font_color ); ?>;
	}
	<?php endif; ?>

	<?php if ( $menu_font_family ) : ?>
	/* Menu Font Family */
	.nav .nav__item {
		font-family: '<?php echo esc_attr( $menu_font_family['font_name'] ); ?>';
	}
	<?php endif; ?>

	<?php if ( $menu_font_size ) : ?>
	/* Menu Font Size */
	.nav > .nav__item > a {
		font-size: <?php echo esc_attr( $menu_font_size ); ?>px;
	}
	<?php endif; ?>

	<?php if ( $theme_color ) : ?>
	/* Theme Color */
	.title__separate::before, .custom-control-input:checked ~ .custom-control-label::before, .progress-bar, .badge--blue, .btn, a.btn, .elementor a.btn, .preloader__progress span, .circle-pulse__1, .circle-menu, .nav, .scroll-line, .social-auth .font-icon, body .swiper-pagination-bullet__item::before, body .swiper-pagination-bullet-active, .timeline__item::before, .content-sidebar .widget-title:before, .page-numbers.current, .post-page-numbers.current, .wp-block-button__link, .main.theme-style-compact .news-item .btn:after, .js-carousel-project .swiper-pagination-bullet-active, .tags-links a, .tagcloud a, .col__sedebar .tagcloud a, .wp-block-tag-cloud a {
		background-color: <?php echo esc_attr( $theme_color ); ?>;
	}
	.title--tone, a, a:hover, .contacts-block__item a:hover, .news-item .title a:hover, .comment-box__footer li:hover, .wp-block-calendar tfoot a, .archive-item a.name:hover, .is-style-outline .wp-block-button__link, .post-password-form input[type="submit"], .wp-block-calendar a, .error-page__num, .main.theme-style-compact .news-item .btn, .main.theme-style-compact .inner-menu.inner-menu-alt .nav__item:hover > a, .pricing-item.content-box .icon {
		color: <?php echo esc_attr( $theme_color ); ?>;
	}
	.custom-control-input:focus:not(:checked) ~ .custom-control-label::before, .custom-control-input:checked ~ .custom-control-label::before, .tags-links a, .tagcloud a, .col__sedebar .tagcloud a, .wp-block-tag-cloud a, .wp-block-button__link, .is-style-outline .wp-block-button__link, .post-password-form input[type="submit"], .archive-item.box .sticky, .input:focus, .textarea:focus, select:focus, .custom-select:focus {
		border-color: <?php echo esc_attr( $theme_color ); ?>;
	}
	.custom-control-input:focus ~ .custom-control-label::before {
		box-shadow: 0 0 0 0.125rem rgba(<?php echo esc_attr( vcard_hexToRgb( $theme_color ) ); ?>, 0.25);
	}
	.btn, a.btn, .elementor a.btn {
		box-shadow: 0 0.5rem 1rem rgba(<?php echo esc_attr( vcard_hexToRgb( $theme_color ) ); ?>, 0.15), 0 0.125rem 0.25rem rgba(<?php echo esc_attr( vcard_hexToRgb( $theme_color ) ); ?>, 0.15);
	}
	.btn:focus, a.btn:focus, .elementor a.btn:focus {
		box-shadow: 0 1.5rem 2.5rem rgba(<?php echo esc_attr( vcard_hexToRgb( $theme_color ) ); ?>, 0.1), 0 0.5rem 1rem rgba(<?php echo esc_attr( vcard_hexToRgb( $theme_color ) ); ?>, 0.1);
	}
	.btn::before, a.btn::before, .elementor a.btn::before {
		box-shadow: 0 0.25rem 2rem rgba(<?php echo esc_attr( vcard_hexToRgb( $theme_color ) ); ?>, 0.25), 0 0.25rem 1rem rgba(<?php echo esc_attr( vcard_hexToRgb( $theme_color ) ); ?>, 0.25);
	}
	.circle-pulse__2 {
		background-color: rgba(<?php echo esc_attr( vcard_hexToRgb( $theme_color ) ); ?>, 0.7);
	}
	.nav {
		box-shadow: 0 1.5rem 2.5rem rgba(<?php echo esc_attr( vcard_hexToRgb( $theme_color ) ); ?>, 0.05), 0 0.5rem 1rem rgba(<?php echo esc_attr( vcard_hexToRgb( $theme_color ) ); ?>, 0.05);
	}
	.timeline__item::before {
		box-shadow: 0 0 0 0.1875rem rgba(<?php echo esc_attr( vcard_hexToRgb( $theme_color ) ); ?>, 0.25);
	}
	@media only screen and (max-width: 580px) {
		.open-menu .circle-menu {
			box-shadow: 0 0 0 0.0625rem rgba(<?php echo esc_attr( vcard_hexToRgb( $theme_color ) ); ?>, 0.5);
		}
	}
	@media only screen and (min-width: 769px) {
	  .filter__item.active a {
	    color: <?php echo esc_attr( $theme_color ); ?>;
	  }
	}
	@media only screen and (max-width: 768px) {
	  .select ul li:hover {
	    background-color: <?php echo esc_attr( $theme_color ); ?>;
	  }
	}
	@media only screen and (max-width: 580px) {
	  .hamburger.is-active .line {
	    background-color: <?php echo esc_attr( $theme_color ); ?>;
	  }
	}
	@media only screen and (min-width: 991px) {
	  .main.theme-style-compact .inner-menu.inner-menu-alt .nav__item > a.active .animated-button, 
	  .main.theme-style-compact .inner-menu.inner-menu-alt .nav__item.current-menu-item > a .animated-button {
	    background-color: <?php echo esc_attr( $theme_color ); ?>;
	  }
	}
	<?php endif; ?>
</style>

<?php
}
add_action( 'wp_head', 'vcard_skin', 10 );