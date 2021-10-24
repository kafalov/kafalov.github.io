<?php
/**
 * Ajax Load Scripts
 */

function vcard_ajax_portfolio_content_scripts() {
	$data = array(
		'url'   => admin_url( 'admin-ajax.php' ),
	);

	if ( ! empty( $data ) ) {
		wp_enqueue_script( 'ajax-portfolio-content', get_template_directory_uri() . '/assets/js/ajax-portfolio-content.js', array( 'jquery' ), '1.0', true );
		wp_localize_script( 'ajax-portfolio-content', 'portfolio_ajax_loading_data', $data );
	}
}
add_action( 'wp_enqueue_scripts', 'vcard_ajax_portfolio_content_scripts' );

/**
 * Ajax Content Loading
 */
function vcard_ajax_portfolio_content() {
	$post_id = $_POST['post_id'];

	/*get categories*/
	$current_categories = get_the_terms( $post_id, 'portfolio_categories' );
	$category = '';
	if ( $current_categories && ! is_wp_error( $current_categories ) ) {
		$arr_keys = array_keys( $current_categories );
		$last_key = end( $arr_keys );
		foreach ( $current_categories as $key => $value ) {
			if ( $key == $last_key ) {
				$category .= $value->name . ' ';
			} else {
				$category .= $value->name . ', ';
			}
		}
	}

	/*get content*/
	$title = get_the_title( $post_id );
	$btn_url = get_field( 'button_url', $post_id );

	?>
	
	<?php if ( has_post_thumbnail( $post_id ) ) : ?>
	<div class="image">
		<?php echo get_the_post_thumbnail( $post_id, 'vcard_680x680' ); ?>
	</div>
	<?php endif; ?>

	<div class="desc">
		<?php if ( $category ) : ?>
		<div class="category"><?php echo esc_html( $category ); ?></div>
		<?php endif; ?>
		<h4><?php echo esc_html( $title ); ?></h4>
		<div class="post-content">
			<?php echo apply_filters( 'the_content', get_post_field( 'post_content', $post_id ) ); ?>
		</div>
		<?php if ( $btn_url ) : ?>
		<a href="<?php echo esc_url( $btn_url ); ?>" class="btn" target="_blank">
			<span class="animated-button"><span><?php echo esc_html__( 'View Project', 'vcard' ); ?></span></span>
			<i class="icon fas fa-chevron-right"></i>
		</a>
		<?php endif; ?>
	</div>
	
	<?php
 	exit;
}
add_action( 'wp_ajax_portfolio_popup', 'vcard_ajax_portfolio_content' );
add_action( 'wp_ajax_nopriv_portfolio_popup', 'vcard_ajax_portfolio_content' );