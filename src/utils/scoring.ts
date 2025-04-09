import { ScoringType } from '../types';

// Helper function to get a ScoringType from string
export function getScoringTypeFromString(scoringOption: string): ScoringType {
  switch (scoringOption) {
    case 'first':
      return ScoringType.FIRST;
    case 'best':
      return ScoringType.BEST;
    case 'unlimited':
      return ScoringType.UNLIMITED;
    default:
      return ScoringType.FIRST;
  }
}

// Helper function to get display text for a scoring type
export function getScoringTypeDisplay(scoringType: ScoringType): string {
  switch (scoringType) {
    case ScoringType.FIRST:
      return 'First Attempt Only';
    case ScoringType.BEST:
      return 'Best of Three Attempts';
    case ScoringType.UNLIMITED:
      return 'Unlimited Attempts';
    default:
      return 'Unknown Scoring Type';
  }
}

// Helper function to get color for scoring type
export function getScoringTypeColor(scoringType: ScoringType): number {
  switch (scoringType) {
    case ScoringType.FIRST:
      return 0x3498db; // Blue
    case ScoringType.BEST:
      return 0x2ecc71; // Green
    case ScoringType.UNLIMITED:
      return 0x9b59b6; // Purple
    default:
      return 0x0099ff; // Default blue
  }
} 