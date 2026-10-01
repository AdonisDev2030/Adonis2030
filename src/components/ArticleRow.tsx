import { useState } from 'react';
import { CATEGORIES, type Article } from '../../shared/news.ts';

const dateFormatter = new Intl.DateTimeFormat('en-GB', {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  timeZone: 'UTC',
});

export function ArticleRow({ article }: { article: Article }) {
  const [failedImage, setFailedImage] = useState<string>();
  const hasImage = article.imageUrl && failedImage !== article.imageUrl;
  const date = article.publishedAt ? new Date(article.publishedAt) : undefined;
  return (
    <article
      className={`article-row grid gap-5 border-b border-line py-7 md:gap-8 md:py-8 ${hasImage ? 'with-image md:grid-cols-[minmax(0,1fr)_192px]' : 'grid-cols-1'}`}
    >
      <div className="article-content min-w-0">
        <div className="article-meta flex flex-wrap items-center gap-x-2 gap-y-1 text-xs leading-5 text-muted [overflow-wrap:anywhere]">
          <span className="publisher font-semibold text-accent">{article.publisher.name}</span>
          {date && (
            <>
              <span aria-hidden="true">·</span>
              <time dateTime={article.publishedAt}>
                {dateFormatter.format(date)}
              </time>
            </>
          )}
        </div>
        <h3 className="mt-2 mb-3 font-serif text-2xl leading-snug tracking-[-0.015em] [overflow-wrap:anywhere] md:text-[27px]">
          <a
            className="decoration-1 underline-offset-4 hover:text-accent hover:underline"
            href={article.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {article.title}
            <span className="article-arrow ml-2 font-sans text-base whitespace-nowrap text-muted" aria-hidden="true">
              ↗
            </span>
            <span className="sr-only"> (opens publisher in a new tab)</span>
          </a>
        </h3>
        {article.summary && (
          <p className="article-summary line-clamp-3 max-w-[80ch] text-sm leading-7 text-muted [overflow-wrap:anywhere]">
            {article.summary}
          </p>
        )}
        <div className="article-byline mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-xs leading-5 text-muted [overflow-wrap:anywhere]">
          {article.authors.length > 0 && (
            <span>{article.authors.map((author) => author.name).join(' · ')}</span>
          )}
          {article.categories.map((category) => (
            <span className="article-category rounded-sm bg-soft px-2 py-0.5 text-accent" key={category}>
              {CATEGORIES.find((item) => item.id === category)?.label}
            </span>
          ))}
        </div>
      </div>
      {hasImage && (
        <img
          className="article-image aspect-video w-full rounded-sm bg-soft object-cover md:aspect-auto md:h-34 md:w-48 md:self-center"
          src={article.imageUrl}
          alt=""
          loading="lazy"
          width="192"
          height="136"
          onError={() => setFailedImage(article.imageUrl)}
        />
      )}
    </article>
  );
}
