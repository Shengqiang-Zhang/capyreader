export const ARTICLE_TEMPLATE = `<!DOCTYPE html>
<html dir="auto" data-theme="{{theme}}">
  <head>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="Content-Security-Policy" content="upgrade-insecure-requests" />
    <meta name="referrer" content="no-referrer" />
    <base href="{{base_href}}" target="_blank" />
    <style>
      :root {
        --color-primary: {{color_primary}};
        --color-surface: {{color_surface}};
        --color-surface-container-highest: {{color_surface_container_highest}};
        --color-on-surface: {{color_on_surface}};
        --color-on-surface-variant: {{color_on_surface_variant}};
        --color-surface-variant: {{color_surface_variant}};
        --color-primary-container: {{color_primary_container}};
        --color-on-primary-container: {{color_on_primary_container}};
        --color-secondary: {{color_secondary}};
        --color-surface-container: {{color_surface_container}};
        --color-surface-tint: {{color_surface_tint}};
        --article-font-size: {{font_size}};
        --article-title-font-size: {{title_font_size}};
        --article-title-text-align: {{title_text_align}};
        --article-line-height: {{line_height}};
        --article-top-margin: {{article_top_margin}};
        --pre-white-space: {{pre_white_space}};
        --table-overflow-x: {{table_overflow_x}};
        color-scheme: {{color_scheme}};
      }
    </style>
    <style>{{inline_css}}</style>
  </head>
  <body>
    <article role="main">
      <header>
        <div class="article__header article__header--font-{{title_font_family}}"{{title_font_style}}>
          <a href="{{external_link}}">
            <h1 class="article__title">{{title}}</h1>
          </a>
          <div class="article__byline">{{byline}}</div>
          <div class="article__feed">{{feed_name}}</div>
        </div>
      </header>
      <div class="article__body article__body--font-{{font_family}}"{{body_font_style}}>
        <div id="article-body-content">{{body}}</div>
      </div>
    </article>
    <script>window.__capyArticleConfig = { imageFallbackProxy: {{article_config_json}} };</script>
    <script>{{inline_js}}</script>
  </body>
</html>`;
