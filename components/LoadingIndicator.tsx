/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React, { useState, useEffect } from 'react';

const loadingMessages = [
  "Préchauffage du réalisateur numérique...",
  "Collecte des pixels et des photons...",
  "Scénarisation de votre vision...",
  "Consultation de la muse IA...",
  "Rendu de la première scène...",
  "Application de l'éclairage cinématographique...",
  "Cela peut prendre quelques minutes, tenez bon !",
  "Ajout d'une touche de magie...",
  "Composition du montage final...",
  "Polissage du chef-d'œuvre...",
  "Apprentissage de la réplique 'I'll be back'...",
  "Vérification des poussières numériques...",
  "Calibrage des capteurs d'ironie...",
  "Démêlage des lignes temporelles...",
  "Passage en vitesse lumière...",
  "Ne vous inquiétez pas, les pixels sont gentils.",
  "Récolte de tiges de bananes nano...",
  "Invocation de l'IA générative...",
  "Rédaction de votre discours pour les Oscars..."
];

const LoadingIndicator: React.FC = () => {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const intervalId = setInterval(() => {
      setMessageIndex((prevIndex) => (prevIndex + 1) % loadingMessages.length);
    }, 3000); // Change message every 3 seconds

    return () => clearInterval(intervalId);
  }, []);

  return (
    <div className="flex flex-col items-center justify-center p-12 bg-gray-800/50 rounded-lg border border-gray-700">
      <div className="w-16 h-16 border-4 border-t-transparent border-indigo-500 rounded-full animate-spin"></div>
      <h2 className="text-2xl font-semibold mt-8 text-gray-200">Génération de votre vidéo</h2>
      <p className="mt-2 text-gray-400 text-center transition-opacity duration-500">
        {loadingMessages[messageIndex]}
      </p>
    </div>
  );
};

export default LoadingIndicator;