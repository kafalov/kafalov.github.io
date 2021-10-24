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

$blog_categories = get_field( 'blog_categories', 'option' );
$blog_excerpt = get_field( 'blog_excerpt', 'option' );
$excerpt_text = get_the_excerpt();
$image = get_the_post_thumbnail_url( get_the_ID(), 'vcard_900x675' );
$post_type = get_post_type();
$post_classes = 'news-item box';
if ( ! $image ) {
	$post_classes .= ' news-item--noimg';
}

?>

<!-- Post -->
<article id="post-<?php the_ID(); ?>" <?php post_class( $post_classes ); ?>>
	<?php if ( $image ) : ?>
    <div class="news-item__image-wrap overlay overlay--45">
	    <div class="news-item__date"><?php echo esc_html( get_the_date() ); ?></div>
		<a class="news-item__link" href="<?php echo esc_url( get_permalink() ); ?>"></a>
	    <img class="cover lazyload" src="<?php echo esc_url( $image ); ?>" alt="<?php echo esc_attr( get_the_title() ); ?>" />
	</div>
	<?php else : ?>
	
	<?php endif; ?>
	<div class="news-item__caption">
		<?php if ( ! $image && $post_type =='post' ) : ?>
		<div class="news-item__date news-item__date--noimg"><?php echo esc_html( get_the_date() ); ?></div>
		<?php endif; ?>
	    <?php if( $blog_categories ) : ?>
		<div class="category-list">
			<div class="category">
				<?php $categories_list = get_the_category();

				if ( $categories_list ) {
					$total = count( $categories_list );
					$i = 0;
					foreach ( $categories_list as $category ) { $i++;
						if ( $total != $i ) {
							echo esc_html( $category->cat_name ) . ', ';
						} else {
							echo esc_html( $category->cat_name );
						}
					}
				} ?>
			</div>
		</div>
		<?php endif; ?>
	    <h2 class="title title--h4"><a href="<?php echo esc_url( get_permalink() ); ?>"><?php the_title(); ?></a></h2>
	    <?php if ( ! $blog_excerpt && $excerpt_text ) : ?>
		<div class="short"><?php the_excerpt(); ?></div>
		<?php endif; ?>
	</div>
</article>