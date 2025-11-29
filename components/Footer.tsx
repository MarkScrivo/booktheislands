import React from 'react';
import { Palmtree, Terminal } from 'lucide-react';
import { APP_VERSION } from '../constants';

export const Footer: React.FC = () => {
  return (
    <footer className="bg-gray-900 text-white py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between items-center">
          <div className="flex items-center gap-2 mb-4 md:mb-0">
            <Palmtree className="w-6 h-6 text-teal-500" />
            <span className="font-bold text-xl">Book The Islands</span>
          </div>
          <div className="text-gray-400 text-sm text-center md:text-right">
            <p>© 2024 Book The Islands. All rights reserved.</p>
            <div className="flex items-center justify-center md:justify-end gap-2 mt-2 opacity-50 hover:opacity-100 transition-opacity">
              <Terminal className="w-3 h-3" />
              <span className="font-mono text-xs">{APP_VERSION}</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
};
