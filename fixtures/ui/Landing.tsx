import { Sparkles, Zap, Rocket } from "lucide-react";

export function Landing() {
  return (
    <main>
      <section className="text-center py-24">
        <span className="uppercase tracking-widest text-xs">✨ New: AI-powered</span>
        <h1 className="text-6xl font-bold bg-gradient-to-r from-purple-500 to-blue-500 bg-clip-text text-transparent">
          Supercharge your workflow
        </h1>
        <p className="text-gray-400 mt-[13px]">Trusted by 10K+ developers · 99.9% uptime</p>
        <a href="/docs">Learn more →</a>
      </section>
      <div className="grid grid-cols-3 gap-6 data-[state=open]:bg-white">
        <div className="rounded-2xl shadow-lg backdrop-blur-md p-6 hover:scale-105 transition-all" onClick={() => alert("hi")}>
          <Sparkles />
          <h3>Feature 1</h3>
          <p>Lorem ipsum dolor sit amet.</p>
        </div>
      </div>
      <img
        src="https://placehold.co/600x400"
        className="w-full"
      />
      <button className="outline-none animate-pulse bg-[#5b5bd6]">Get started</button>
    </main>
  );
}

export function Features() {
  return (
    <section className="bg-white/5 border-white/10">
      <nav className="font-mono text-xs"><span>~/src/components/Hero.tsx</span></nav>
      <h2 className="font-serif tracking-tighter">Built for <em>people</em></h2>
      <div className="flex gap-2 text-white/60 ring-white/20">
        <span className="rounded-full text-xs">New</span>
        <span className="rounded-full text-xs">Beta</span>
        <span className="rounded-full text-xs">Pro</span>
      </div>
      <hr />
      <div className="border rounded-xl p-6"><span>01</span></div>
      <hr />
      <div className="border rounded-xl p-6"><span>02</span></div>
      <hr />
      <div className="border rounded-xl p-6">c</div>
      <div className="ring-1 rounded-lg px-4">d</div>
      <div className="border rounded-xl py-6">e</div>
      <svg viewBox="0 0 100 100">
        <circle cx="10" cy="10" r="2" /><circle cx="20" cy="10" r="2" /><circle cx="30" cy="10" r="2" /><circle cx="40" cy="10" r="2" />
        <line x1="10" y1="10" x2="20" y2="10" /><line x1="20" y1="10" x2="30" y2="10" /><line x1="30" y1="10" x2="40" y2="10" /><line x1="40" y1="10" x2="50" y2="10" />
        <path d="M0 0" /><path d="M1 1" /><path d="M2 2" /><path d="M3 3" />
      </svg>
    </section>
  );
}
