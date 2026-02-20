import Navbar from "../components/Navbar";
import Hero from "../sections/Hero";
import Features from "../sections/Features";
import HowItWorks from "../sections/HowItWorks";
import Mission from "../sections/Mission";
import CTA from "../sections/CTA";
import Footer from "../components/Footer";
import "../styles/landing.css";

export default function Landing() {
  return (
    <>
      <Hero />
      <Features />
      <HowItWorks />
      <Mission />
      <CTA />
      <Footer />
    </>
  );
}
