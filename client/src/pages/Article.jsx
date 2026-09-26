import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion, useScroll, useSpring } from 'framer-motion';
import Seo, { breadcrumbLd } from '../components/Seo';
import { Reveal, SplitHeading } from '../components/Motion';
import { PostCard, Loading } from '../components/Bits';
import ProductCard from '../components/ProductCard';
import { scrollToEl } from '../components/SmoothScroll';
import { useApi } from '../hooks/useApi';
import { useStore } from '../context/StoreContext';
import { formatDate, whatsappLink } from '../lib/format';
import { renderMarkdown } from '../lib/markdown';
import { NotFound } from './InfoPages';

export default function Article() {
  const { slug } = useParams();
  const { data, loading, error } = useApi(`/posts/${slug}`);
  const { toast } = useStore();
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 120, damping: 30 });
  const [activeId, setActiveId] = useState(null);

  const rendered = useMemo(() => renderMarkdown(data?.post?.content), [data?.post?.content]);

  useEffect(() => {
    if (!rendered.toc.length) return;
    const els = rendered.toc.map((t) => document.getElementById(t.id)).filter(Boolean);
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => e.isIntersecting && setActiveId(e.target.id)),
      { rootMargin: '-20% 0px -70% 0px' }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [rendered]);

  if (loading && !data) return <div className="page-pad"><Loading label="Opening the Journal" /></div>;
  if (error?.status === 404) return <NotFound />;
  if (!data) return null;
  const { post, related, products } = data;

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      toast('Link copied');
    } catch {
      toast('Copy the link from your address bar', 'warn');
    }
  };

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt,
    image: post.cover?.src ? [window.location.origin + post.cover.src] : undefined,
    datePublished: post.publishedAt,
    dateModified: post.updatedAt,
    author: { '@type': 'Organization', name: post.author },
    publisher: { '@type': 'Organization', name: 'AL BARAKAH LIFESTYLE', logo: { '@type': 'ImageObject', url: window.location.origin + '/media/emblem.webp' } },
  };

  return (
    <article className="article">
      <Seo
        title={post.seo?.title || post.title}
        description={post.seo?.description || post.excerpt}
        image={post.cover?.src}
        type="article"
        jsonLd={[ld, breadcrumbLd([['Home', '/'], ['Journal', '/journal'], [post.title, `/journal/${post.slug}`]])]}
      />
      <motion.div className="read-progress" style={{ scaleX: progress }} aria-hidden="true" />
      <header className="article-hero">
        {post.cover?.src && (
          <motion.div className="article-hero-img" initial={{ scale: 1.12, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 1.6, ease: [0.2, 0.7, 0.2, 1] }}>
            <img src={post.cover.src} alt={post.cover.alt || ''} />
          </motion.div>
        )}
        <div className="container article-hero-inner">
          <nav className="crumbs" aria-label="Breadcrumb">
            <Link to="/">Home</Link><span>/</span><Link to="/journal">Journal</Link><span>/</span><span>{post.category}</span>
          </nav>
          <motion.p className="eyebrow" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>{post.category} · {post.readingMinutes} min read</motion.p>
          <SplitHeading as="h1" text={post.title} delay={0.1} />
          {post.excerpt && <motion.p className="lede" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>{post.excerpt}</motion.p>}
          <p className="article-meta">By {post.author} · {formatDate(post.publishedAt)}</p>
        </div>
      </header>

      <div className="container article-layout">
        <aside className="article-aside">
          {rendered.toc.length > 2 && (
            <nav className="toc" aria-label="In this article">
              <p className="eyebrow">In this story</p>
              <ol>
                {rendered.toc.map((t) => (
                  <li key={t.id}>
                    <a
                      href={`#${t.id}`}
                      className={activeId === t.id ? 'is-active' : ''}
                      onClick={(e) => {
                        e.preventDefault();
                        scrollToEl(document.getElementById(t.id));
                      }}
                    >
                      {t.text}
                    </a>
                  </li>
                ))}
              </ol>
            </nav>
          )}
          <div className="share">
            <p className="eyebrow">Share</p>
            <a href={whatsappLink(`${post.title} ${window.location.href}`)} target="_blank" rel="noreferrer">WhatsApp</a>
            <button onClick={copyLink}>Copy link</button>
          </div>
        </aside>
        <Reveal className="prose">
          <div dangerouslySetInnerHTML={{ __html: rendered.html }} />
          {post.tags?.length > 0 && (
            <div className="tags">{post.tags.map((t) => <span key={t}>#{t}</span>)}</div>
          )}
        </Reveal>
      </div>

      {products?.length > 0 && (
        <section className="section article-products">
          <div className="container">
            <div className="section-head">
              <Reveal><p className="eyebrow">From this story</p></Reveal>
              <SplitHeading text="The fragrances" />
            </div>
            <div className="product-grid">
              {products.map((p, i) => <ProductCard key={p._id} product={p} index={i} />)}
            </div>
          </div>
        </section>
      )}

      {related?.length > 0 && (
        <section className="section">
          <div className="container">
            <div className="section-head split">
              <SplitHeading text="Keep reading" />
              <Link to="/journal" className="text-link">All stories →</Link>
            </div>
            <div className="post-grid">
              {related.map((p, i) => <PostCard key={p._id} post={p} index={i} />)}
            </div>
          </div>
        </section>
      )}
    </article>
  );
}
