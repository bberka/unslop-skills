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
      <div className="grid grid-cols-3 gap-6">
        <div className="rounded-2xl shadow-lg backdrop-blur-md p-6 hover:scale-105 transition-all" onClick={() => alert("hi")}>
          <Sparkles />
          <h3>Feature 1</h3>
          <p>Lorem ipsum dolor sit amet.</p>
        </div>
      </div>
      <img src="https://placehold.co/600x400" />
      <button className="outline-none animate-pulse bg-[#5b5bd6]">Get started</button>
    </main>
  );
}
