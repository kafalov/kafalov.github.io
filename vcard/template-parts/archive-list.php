<?php
/**
 * Template part for displaying archive list
 *
 * @link https://developer.wordpress.org/themes/basics/template-hierarchy/
 *
 * @package vcard
 */

?>

<?php 

$layout = get_field( 'blog_layout', 'option' ); 

?>

<?php if ( $layout == 1 ) : ?>

    <?php if ( have_posts() ) : ?>
    <!-- News -->
    <div class="news-grid pb-0">
        <?php
        /* Start the Loop */
        while ( have_posts() ) : the_post();

            /*
             * Include the Post-Type-specific template for the content.
             * If you want to override this in a child theme, then include a file
             * called content-___.php (where ___ is the Post Type name) and that will be used instead.
             */
            get_template_part( 'template-parts/content', 'grid' );

        endwhile;
        ?>
    </div>

    <?php if ( get_the_posts_pagination() ) : ?>
    <div class="pagination">
        <?php
            echo paginate_links( array(
                'prev_text'     => esc_html__( 'Prev', 'vcard' ),
                'next_text'     => esc_html__( 'Next', 'vcard' ),
            ) );
        ?>
    </div>
    <?php endif; ?>

    <?php else :
        get_template_part( 'template-parts/content', 'none' );
    endif; ?>

<?php else : ?>

    <?php if ( have_posts() ) : ?>
    <div class="archive-row pb-0">                
        <?php
        /* Start the Loop */
        while ( have_posts() ) : the_post(); ?>

            <?php
            /*
             * Include the Post-Type-specific template for the content.
             * If you want to override this in a child theme, then include a file
             * called content-___.php (where ___ is the Post Type name) and that will be used instead.
             */
            get_template_part( 'template-parts/content' );
            ?>
        
        <?php endwhile; ?>
    </div>

    <?php if ( get_the_posts_pagination() ) : ?>
    <div class="pagination">
        <?php
            echo paginate_links( array(
                'prev_text'     => esc_html__( 'Prev', 'vcard' ),
                'next_text'     => esc_html__( 'Next', 'vcard' ),
            ) );
        ?>
    </div>
    <?php endif; ?>
    
    <?php else : ?>
        <?php get_template_part( 'template-parts/content', 'none' ); ?>
    <?php endif; ?>

<?php endif; ?>