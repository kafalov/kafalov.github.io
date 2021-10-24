<?php
/**
 * Template part for displaying page content in page.php
 *
 * @link https://developer.wordpress.org/themes/basics/template-hierarchy/
 *
 * @package vcard
 */

?>

<div id="post-<?php the_ID(); ?>" <?php post_class(); ?>>
	<div class="single-post-text">
		<?php 
			the_content(); 

			wp_link_pages( array(
				'before' => '<div class="page-links">' . esc_html__( 'Pages:', 'vcard' ),
				'after'  => '</div>',
			) );
		?>
	</div>
	<div class="single-post-bottom">
		<?php vcard_entry_footer(); ?>
	</div>
</div><!-- #post-<?php the_ID(); ?> -->