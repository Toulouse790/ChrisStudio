
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
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-4">Clé API requise</h2>
        <p className="text-gray-300 mb-6 text-sm md:text-base">
          ChrisStudio utilise des modèles IA avancés pour la génération vidéo. Veuillez configurer votre clé API pour commencer.
        </p>
        <p className="text-gray-400 mb-8 text-xs md:text-sm">
          La génération vidéo IA est un service payant à l'utilisation. Les coûts dépendent du modèle et de la durée des vidéos générées.
        </p>
        <button
          onClick={onContinue}
          className="w-full px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition-colors text-base md:text-lg"
        >
          Configurer ma clé API
        </button>
      </div>
    </div>
  );
};

export default ApiKeyDialog;
