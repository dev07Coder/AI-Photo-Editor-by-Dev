/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';

interface TemplatePanelProps {
  onApplyAdjustment: (prompt: string) => void;
  isLoading: boolean;
}

const TemplatePanel: React.FC<TemplatePanelProps> = ({ onApplyAdjustment, isLoading }) => {
  const templates = [
    { name: '90s Film Reel', prompt: "Transform this image to look like a frame from a 90s film reel. Add film grain, a cinematic color grade with slightly muted colors and warm highlights, and add a subtle white border with faux film perforations on the sides." },
    { name: 'Scrapbook Story', prompt: "Recreate this image in a digital scrapbook style. Place the photo on a textured paper background, give it a slightly torn white polaroid-style border, and add some digital 'tape' in the corners holding it down." },
    { name: 'Minimalist Mag', prompt: "Redesign this image to be the cover of a minimalist art magazine. Place the image centrally, add a clean, bold, sans-serif title like 'VISION' at the top, and some small placeholder text at the bottom for an article title." },
    { name: 'Neon Noir', prompt: "Give this image a neon noir aesthetic. Dramatically increase contrast, add vibrant neon glows to light sources, and apply a cool, blue-cyan color grade to the shadows." },
  ];

  return (
    <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex flex-col gap-4 animate-fade-in backdrop-blur-sm">
      <h3 className="text-lg font-semibold text-center text-gray-300">Apply a Social Template</h3>
      <p className="text-sm text-gray-400 text-center -mt-2">Transform your image with a single click based on trending styles.</p>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {templates.map(template => (
          <button
            key={template.name}
            onClick={() => onApplyAdjustment(template.prompt)}
            disabled={isLoading}
            className="text-center bg-white/10 border border-transparent text-gray-200 font-semibold py-6 px-4 rounded-md transition-all duration-200 ease-in-out hover:bg-white/20 hover:border-white/20 active:scale-95 text-base disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {template.name}
          </button>
        ))}
      </div>
    </div>
  );
};

export default TemplatePanel;
