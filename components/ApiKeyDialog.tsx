
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import { KeyIcon } from './icons';

interface ApiKeyDialogProps {
  onContinue: () => void;
}

const ApiKeyDialog: React.FC<ApiKeyDialogProps> = ({ onContinue }) => {
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 border border-gray-700 rounded-2xl shadow-xl max-w-lg w-full p-6 md:p-8 text-center flex flex-col items-center m-4">
        <div className="bg-indigo-600/20 p-4 rounded-full mb-6">
          <KeyIcon className="w-10 h-10 md:w-12 md:h-12 text-indigo-400" />
        </div>
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">Clé API payante requise pour Veo</h2>
        <p className="text-gray-300 mb-6 text-sm md:text-base">
          Veo est un modèle de génération vidéo payant. Pour utiliser cette fonctionnalité, veuillez configurer une clé API avec facturation activée.
        </p>
        <p className="text-gray-400 mb-8 text-xs md:text-sm">
          Pour plus d'informations, voir{' '}
          <a
            href="https://ai.google.dev/gemini-api/docs/billing"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-400 hover:underline font-medium"
          >
            comment activer la facturation
          </a>{' '}
          et{' '}
          <a
            href="https://ai.google.dev/gemini-api/docs/pricing#veo-3"
            target="_blank"
            rel="noopener noreferrer"
            className="text-indigo-400 hover:underline font-medium"
          >
            tarification Veo
          </a>.
        </p>
        <button
          onClick={onContinue}
          className="w-full px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors text-base md:text-lg"
        >
          Continuer pour sélectionner une clé API payante
        </button>
      </div>
    </div>
  );
};

export default ApiKeyDialog;
