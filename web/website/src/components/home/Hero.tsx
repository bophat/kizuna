import { motion } from 'motion/react';
import { Link } from 'react-router-dom';

export function Hero() {
  return (
    <section className="relative h-[70vh] min-h-[500px] w-full overflow-hidden bg-surface-container-highest">
      <motion.img
        initial={{ scale: 1.1, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 1.5, ease: "easeOut" }}
        src="https://lh3.googleusercontent.com/aida-public/AB6AXuAqpBNrVamIcnRbUQdoC7vTZ9D9BtHT4TMHQE_kEOzIei3WCInZgkXdYaDR6frlaXncEMi9JlDaYxB7oO574Glm_yqQkEpYQ1AlgcGdG3DgKwrJiQFsNJJkBOuMuonUo2HjW4WmoKoFRyy_tC2gpzEA1J1dFT7J2WxKxVyCrkHckPPg0nE6ojNqKplUCJtkyJArB5NYQlCqmunXxnynjdYrsJo3dwjcjZSy9myMdmSP0oN4t0NyDnUMLPOj4kcG-YTcVpXFsmCx-U0"
        alt="Art of Stillness"
        className="h-full w-full object-cover object-center"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent flex flex-col justify-end p-xl">
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.5, duration: 0.8 }}
          className="max-w-2xl"
        >
          <h1 className="headline-xl text-white mb-4">The Art of Stillness</h1>
          <p className="body-lg text-white/90 mb-8">
            Discover curated objects of utility and beauty, handcrafted by master artisans across Japan.
          </p>
          <Link
            to="/collections"
            className="inline-flex bg-primary-container text-white label-md px-10 py-4 rounded-sm hover:bg-primary transition-colors"
          >
            Explore Collection
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
