import Navbar from "@/components/Navbar";
import HeroSection from "@/components/HeroSection";
import MovieGrid from "@/components/MovieGrid";
import { useLenis } from "@/hooks/useLenis";

const Index = () => {
  useLenis();

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <HeroSection />
      <MovieGrid />
      <div className="h-32" />
    </div>
  );
};

export default Index;
