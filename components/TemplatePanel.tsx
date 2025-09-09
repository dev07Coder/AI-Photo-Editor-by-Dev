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
    { name: 'Film Strip Story', prompt: "Format this for a 9:16 Instagram story. Transform this image to look like a frame from a 90s film reel. Add film grain, a cinematic color grade with slightly muted colors and warm highlights, and add a subtle white border with faux film perforations on the sides." },
    { name: 'Digital Scrapbook', prompt: "Format this image for an Instagram story. Recreate it in a digital scrapbook style. Place the photo on a textured paper background, give it a slightly torn white polaroid-style border, and add some digital 'tape' in the corners holding it down. Leave some space for text." },
    { name: 'Magazine Cover', prompt: "Format for a 9:16 Instagram story. Redesign this image to be the cover of a minimalist art magazine. Place the image centrally, add a clean, bold, sans-serif title like 'VISION' at the top, and some small placeholder text at the bottom for an article title." },
    { name: 'Neon Glow Story', prompt: "Format this for an Instagram story. Give this image a neon noir aesthetic. Dramatically increase contrast, add vibrant neon glows to light sources, and apply a cool, blue-cyan color grade to the shadows." },
  ];

  return (
    <div className="w-full bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex flex-col gap-4 animate-fade-in backdrop-blur-sm">
      <h3 className="text-lg font-semibold text-center text-gray-300">Create an Instagram Story</h3>
      <p className="text-sm text-gray-400 text-center -mt-2">Transform your photo into a share-worthy story with one click.</p>

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
