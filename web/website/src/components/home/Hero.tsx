import { Link } from 'react-router-dom';
import { optimizeImageUrl, IMAGE_WIDTH } from '@izuna/shared/lib/image';

const HERO_SRC =
  'https://lh3.googleusercontent.com/aida-public/AB6AXuAqpBNrVamIcnRbUQdoC7vTZ9D9BtHT4TMHQE_kEOzIei3WCInZgkXdYaDR6frlaXncEMi9JlDaYxB7oO574Glm_yqQkEpYQ1AlgcGdG3DgKwrJiQFsNJJkBOuMuonUo2HjW4WmoKoFRyy_tC2gpzEA1J1dFT7J2WxKxVyCrkHckPPg0nE6ojNqKplUCJtkyJArB5NYQlCqmunXxnynjdYrsJo3dwjcjZSy9myMdmSP0oN4t0NyDnUMLPOj4kcG-YTcVpXFsmCx-U0';

export function Hero() {
  return (
    <section className="relative h-[70vh] min-h-[500px] w-full overflow-hidden bg-surface-container-highest">
      <img
        src={optimizeImageUrl(HERO_SRC, IMAGE_WIDTH.hero)}
        alt="Art of Stillness"
        width={IMAGE_WIDTH.hero}
        height={Math.round(IMAGE_WIDTH.hero * 0.6)}
        loading="eager"
        fetchPriority="high"
        decoding="async"
        className="h-full w-full object-cover object-center animate-hero-zoom gpu-transform"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent flex flex-col justify-end p-xl">
        <div className="max-w-2xl animate-fade-up">
          <h1 className="headline-xl text-white mb-4">The Art of Stillness</h1>
          <p className="body-lg text-white/90 mb-8">
            Discover curated objects of utility and beauty, handcrafted by master artisans across Japan.
          </p>
          <Link
            to="/collections"
            className="inline-flex bg-primary-container text-white label-md px-10 py-4 rounded-sm hover:bg-primary transition-colors duration-200"
          >
            Explore Collection
          </Link>
        </div>
      </div>
    </section>
  );
}
