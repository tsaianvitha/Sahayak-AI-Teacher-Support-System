import React from 'react';
import { GraduationCap } from 'lucide-react';

const Footer = () => {
  return (
    <footer>
      <div className="footer-brand">
        <GraduationCap size={20} />
        <span>TeachAssist</span>
      </div>
      <div className="footer-links">
        <p>Empowering teachers everywhere • Free forever • Built with ❤️ for educators</p>
      </div>
    </footer>
  );
};

export default Footer;