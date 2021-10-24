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

?>

<div class="archive-col">
	<div class="archive-item box">
		<div id="post-<?php the_ID(); ?>" <?php post_class(); ?>>
			<div class="image">
				<?php vcard_post_thumbnail( 'blog' ); ?>
			</div>
			<div class="desc">
				<?php if( $blog_categories ) : ?>
					<div class="category-list">
						<div class="category">
							<?php

							$categories_list = get_the_category();

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
								echo esc_html( ' / ', 'vcard' );
							}

							?>
						</div>
					</div>
				<?php endif; ?>

				<?php if ( 'post' === get_post_type() ) : ?>
					<div class="date">
						<a href="<?php echo esc_url( get_permalink() ); ?>"><?php echo esc_html( get_the_date() ); ?></a>
					</div>
				<?php endif; ?>

				<a href="<?php echo esc_url( get_permalink() ); ?>" class="name"><?php the_title(); ?></a>

				<?php if ( ! $blog_excerpt && $excerpt_text ) : ?>
				<div class="single-post-text">
					<?php the_excerpt(); ?>
				</div>
				<?php endif; ?>
			</div>
		</div>
	</div>
</div>
