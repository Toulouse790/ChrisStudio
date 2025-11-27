
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import React from 'react';
import {
  Archive,
  ArrowDown,
  ArrowRight,
  Baseline,
  Calendar,
  Captions,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  Copy,
  Download,
  Edit,
  ExternalLink,
  Film,
  Image,
  KeyRound,
  Layers,
  LayoutDashboard,
  Library,
  ListOrdered,
  Menu,
  Mic,
  Music,
  Play,
  Plus,
  RefreshCw,
  Save,
  Settings,
  SlidersHorizontal,
  Sparkles,
  Square,
  Trash2,
  Tv,
  UploadCloud,
  Users,
  Video,
  Volume2,
  Wand2,
  X,
  Youtube,
} from 'lucide-react';

const defaultProps = {
  strokeWidth: 1.5,
};

export const KeyIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <KeyRound {...defaultProps} {...props} />
);

export const ArrowPathIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => <RefreshCw {...defaultProps} {...props} />;

export const SparklesIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <Sparkles {...defaultProps} {...props} />
);

export const PlusIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <Plus {...defaultProps} {...props} />
);

export const ChevronDownIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => <ChevronDown {...defaultProps} {...props} />;

export const SlidersHorizontalIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => <SlidersHorizontal {...defaultProps} {...props} />;

export const ArrowRightIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => <ArrowRight {...defaultProps} {...props} />;

export const RectangleStackIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => <Layers {...defaultProps} {...props} />;

export const XMarkIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <X {...defaultProps} {...props} />
);

export const TextModeIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <Baseline {...defaultProps} {...props} />
);

export const FramesModeIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => <Image {...defaultProps} {...props} />;

export const ImageModeIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => <Image {...defaultProps} {...props} />;

export const ReferencesModeIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => <Film {...defaultProps} {...props} />;

export const TvIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <Tv {...defaultProps} {...props} />
);

export const FilmIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <Film {...defaultProps} {...props} />
);

// This icon had a different stroke width in the original file, so we preserve it.
export const CurvedArrowDownIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => <ArrowDown {...props} strokeWidth={3} />;

// --- New Icons ---

export const LayoutDashboardIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => <LayoutDashboard {...defaultProps} {...props} />;

export const VideoIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <Video {...defaultProps} {...props} />
);

export const LibraryIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <Library {...defaultProps} {...props} />
);

export const SettingsIcon: React.FC<React.SVGProps<SVGSVGElement>> = (props) => (
  <Settings {...defaultProps} {...props} />
);

export const ArrowDownIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => <ArrowDown {...defaultProps} {...props} />;

export const DownloadIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => <Download {...defaultProps} {...props} />;

export const ArchiveIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => <Archive {...defaultProps} {...props} />;

export const CheckSquareIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => <CheckSquare {...defaultProps} {...props} />;

export const SquareIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => <Square {...defaultProps} {...props} />;

export const TrashIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => <Trash2 {...defaultProps} {...props} />;

export const UploadCloudIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => <UploadCloud {...defaultProps} {...props} />;

export const CaptionsIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => <Captions {...defaultProps} {...props} />;

export const YoutubeIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => <Youtube {...defaultProps} {...props} />;

export const CopyIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => <Copy {...defaultProps} {...props} />;

export const ExternalLinkIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => <ExternalLink {...defaultProps} {...props} />;

export const CheckCircleIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => <CheckCircle2 {...defaultProps} {...props} />;

export const MenuIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => <Menu {...defaultProps} {...props} />;

export const SaveIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => <Save {...defaultProps} {...props} />;

export const PlayIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => <Play {...defaultProps} {...props} />;

export const ListOrderedIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => <ListOrdered {...defaultProps} {...props} />;

export const MicIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => <Mic {...defaultProps} {...props} />;

export const Volume2Icon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => <Volume2 {...defaultProps} {...props} />;

export const WandIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => <Wand2 {...defaultProps} {...props} />;

export const MusicIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => <Music {...defaultProps} {...props} />;

export const UsersIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => <Users {...defaultProps} {...props} />;

export const CalendarIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => <Calendar {...defaultProps} {...props} />;

export const CheckIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => <Check {...defaultProps} {...props} />;

export const XIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => <X {...defaultProps} {...props} />;

export const EditIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => <Edit {...defaultProps} {...props} />;

export const RefreshIcon: React.FC<React.SVGProps<SVGSVGElement>> = (
  props,
) => <RefreshCw {...defaultProps} {...props} />;
