import Hero from "@/components/hero/Hero";

export default function Home() {
  return (
    <main>
      <Hero />
      {/* The hero fades to black at its end; the next section picks up from there. */}
      <section style={{ height: "100vh", background: "#010101" }} />
    </main>
  );
}
