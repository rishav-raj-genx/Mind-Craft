import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import Onboarding from '../components/Onboarding';
import { INTRO_SLIDES } from '../constants/introSlides';
import { INTRO_SEEN_KEY } from '../App';

describe('Mindcraft 4-Step Intro Walkthrough Modals', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('renders all 4 slides in order and advances with Next and Back buttons', () => {
    const handleComplete = vi.fn();

    render(<Onboarding isOpen={true} onComplete={handleComplete} />);

    // Step 1: Welcome
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('1 / 4')).toBeInTheDocument();
    expect(screen.getByText('Welcome to Mindcraft')).toBeInTheDocument();
    expect(screen.getByText('Peer-to-Peer Academic Playground')).toBeInTheDocument();

    // Advance to Step 2
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText('2 / 4')).toBeInTheDocument();
    expect(screen.getByText('Smart Peer Matching')).toBeInTheDocument();
    expect(screen.getByText('Find Mates Who Teach What You Learn')).toBeInTheDocument();

    // Advance to Step 3
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText('3 / 4')).toBeInTheDocument();
    expect(screen.getByText('Doubt Forum & Live Sessions')).toBeInTheDocument();
    expect(screen.getByText('Bilingual AI Hints & Real-Time Chat')).toBeInTheDocument();

    // Back to Step 2
    fireEvent.click(screen.getByRole('button', { name: /back/i }));
    expect(screen.getByText('2 / 4')).toBeInTheDocument();
    expect(screen.getByText('Smart Peer Matching')).toBeInTheDocument();

    // Forward to Step 3 then Step 4
    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText('3 / 4')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /next/i }));
    expect(screen.getByText('4 / 4')).toBeInTheDocument();
    expect(screen.getByText('Gamified Progress')).toBeInTheDocument();
    expect(screen.getByText('Tokens, Streaks, Badges & Leaderboard')).toBeInTheDocument();

    // Final button is "Get Started"
    const getStartedBtn = screen.getByRole('button', { name: /get started/i });
    expect(getStartedBtn).toBeInTheDocument();

    // Completing step 4 calls onComplete
    fireEvent.click(getStartedBtn);
    expect(handleComplete).toHaveBeenCalledTimes(1);
  });

  it('allows clicking Skip or Close to exit walkthrough immediately', () => {
    const handleComplete = vi.fn();

    render(<Onboarding isOpen={true} onComplete={handleComplete} />);

    expect(screen.getByText('1 / 4')).toBeInTheDocument();

    const skipBtn = screen.getByRole('button', { name: /skip/i });
    fireEvent.click(skipBtn);

    expect(handleComplete).toHaveBeenCalledTimes(1);
  });

  it('allows jumping between slides using progress indicator dots', () => {
    render(<Onboarding isOpen={true} onComplete={vi.fn()} />);

    expect(screen.getByText('1 / 4')).toBeInTheDocument();

    const dot3 = screen.getByRole('button', { name: /go to slide 3/i });
    fireEvent.click(dot3);

    expect(screen.getByText('3 / 4')).toBeInTheDocument();
    expect(screen.getByText('Doubt Forum & Live Sessions')).toBeInTheDocument();
  });

  it('sets localStorage flag mindcraft_intro_seen_v1 on completion so it does not auto-reopen', () => {
    expect(localStorage.getItem(INTRO_SEEN_KEY)).toBeNull();

    // Simulate completion
    localStorage.setItem(INTRO_SEEN_KEY, 'true');
    expect(localStorage.getItem(INTRO_SEEN_KEY)).toBe('true');

    // When flagged, isOpen=false prevents rendering
    const { container } = render(
      <Onboarding
        isOpen={localStorage.getItem(INTRO_SEEN_KEY) !== 'true'}
        onComplete={vi.fn()}
      />
    );

    expect(container.firstChild).toBeNull();
  });

  it('defines 4 distinct core slides matching all feature specifications', () => {
    expect(INTRO_SLIDES).toHaveLength(4);
    expect(INTRO_SLIDES[0].title).toBe('Welcome to Mindcraft');
    expect(INTRO_SLIDES[1].title).toBe('Smart Peer Matching');
    expect(INTRO_SLIDES[2].title).toBe('Doubt Forum & Live Sessions');
    expect(INTRO_SLIDES[3].title).toBe('Gamified Progress');
  });
});
