<?php
/**
 * Background Options
**/

function vcard_bg() {
	$bg_type = get_field( 'bg_type', 'option' );
	$bg_color = get_field( 'bg_color', 'option' );
	$bg_color1 = get_field( 'bg_color1', 'option' );
	$bg_color2 = get_field( 'bg_color2', 'option' );
	$bg_angle = get_field( 'bg_angle', 'option' );
	$bg_image = get_field( 'bg_image', 'option' );
	$bg_objects = get_field( 'bg_objects', 'option' );
	$bg_size = get_field( 'bg_size', 'option' );
	if ( $bg_size == 'value' ) {
		$bg_size = get_field( 'bg_size_value', 'option' );
	}
	$bg_repeat = get_field( 'bg_repeat', 'option' );
	$bg_position = get_field( 'bg_position', 'option' );
	if ( $bg_position == 'value' ) {
		$bg_position = get_field( 'bg_position_value', 'option' );
	}
	$bg_attachment = get_field( 'bg_attachment', 'option' );
?>

<style>
	/* BG Options */
	body {
		<?php if ( $bg_type == 1 ) : ?>
		background-color: <?php echo esc_attr( $bg_color ); ?>;
		<?php elseif ( $bg_type == 2 ) : ?>
		background-image: linear-gradient(<?php echo esc_attr( $bg_angle ); ?>deg, <?php echo esc_attr( $bg_color1 ); ?> 1.33%, <?php echo esc_attr( $bg_color2 ); ?> 98.21%);
  		background-attachment: fixed;
		<?php elseif ( $bg_type == 3 ) : ?>
		background-color: <?php echo esc_attr( $bg_color ); ?>;
		background-image: url(<?php echo esc_url( $bg_image ); ?>);
		background-size: <?php echo esc_attr( $bg_size ); ?>;
		background-position: <?php echo esc_attr( $bg_position ); ?>;
		background-repeat: <?php echo esc_attr( $bg_repeat ); ?>;
		background-attachment: <?php echo esc_attr( $bg_attachment ); ?>;
		<?php elseif ( $bg_type == 4 ) : ?>
		<?php if ( $bg_objects == 0 ) : ?>
		background-image: url(<?php echo esc_url( get_template_directory_uri() ); ?>/assets/images/triangles-top.svg), url(<?php echo esc_url( get_template_directory_uri() ); ?>/assets/images/triangles-bottom.svg);
		background-position: left top, right bottom;
		background-repeat: no-repeat;
		background-size: inherit;
		<?php elseif ( $bg_objects == 1 ) : ?>
		background-image: url(<?php echo esc_url( get_template_directory_uri() ); ?>/assets/images/triangle-2-top.svg), url(<?php echo esc_url( get_template_directory_uri() ); ?>/assets/images/triangle-2-bottom.svg);
		background-position: right top, left bottom;
		background-repeat: no-repeat;
		background-size: 50%;
		background-attachment: fixed;
		<?php endif; ?>
		<?php endif; ?>
	}
	@media only screen and (max-width: 991px) {
		body {
			<?php if ( $bg_type == 4 ) : if ( $bg_objects == 1 ) : ?>
			background-size: contain;
			<?php endif; endif; ?>
		}
	}
	@media only screen and (max-width: 580px) {
		body {
			<?php if ( $bg_type == 4 ) : if ( $bg_objects == 0 ) : ?>
			background-size: contain;
			<?php endif; endif; ?>
		}
	}
</style>

<?php
}
add_action( 'wp_head', 'vcard_bg', 10 );