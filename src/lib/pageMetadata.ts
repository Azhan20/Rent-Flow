import { useEffect } from 'react';

export function usePageMetadata(title: string, indexable: boolean) {
  useEffect(() => {
    const previousTitle = document.title;
    let robots = document.querySelector<HTMLMetaElement>('meta[name="robots"]');
    const created = !robots;
    if (!robots) {
      robots = document.createElement('meta');
      robots.name = 'robots';
      document.head.appendChild(robots);
    }
    const previousRobots = robots.content;
    document.title = title;
    robots.content = indexable ? 'index, follow' : 'noindex, nofollow';
    return () => {
      document.title = previousTitle;
      if (created) robots?.remove();
      else if (robots) robots.content = previousRobots;
    };
  }, [title, indexable]);
}
