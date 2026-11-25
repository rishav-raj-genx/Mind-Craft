import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import FindMate from '../pages/FindMate';
import * as authContext from '../context/AuthContext';
import * as peerHooks from '../hooks/usePeerMatches';

vi.mock('react-force-graph-2d', () => ({
  default: () => <div data-testid="force-graph-2d" />,
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../hooks/usePeerMatches', () => ({
  usePeerMatches: vi.fn(),
  useFollowing: vi.fn(),
  useMetadataOptions: vi.fn(),
  useSearchUsers: vi.fn(),
  useFollowUser: vi.fn(),
}));

vi.mock('../services/chatService', () => ({
  chatService: {
    getOrCreateThread: vi.fn(),
  },
}));

vi.mock('../services/voiceService', () => ({
  voiceService: {
    search: vi.fn(),
  },
}));

const mockCurrentUser = {
  uid: 'current-user-uid',
  name: 'Current User',
  email: 'current@example.com',
};

const mockMatches = [
  {
    uid: 'mate-1',
    name: 'Siddharth Rao',
    college: 'IIT Madras',
    department: 'Computer Science',
    year: '3rd Year',
    averageRating: 4.8,
    teaches: ['Data Structures', 'Algorithms', 'Python'],
    sharedSkills: ['Data Structures'],
    photoUrl: '',
    activityScore: 92,
  },
  {
    uid: 'mate-2',
    name: 'Ananya Sharma',
    college: 'BITS Pilani',
    department: 'Electrical Engineering',
    year: '4th Year',
    averageRating: 4.9,
    teaches: ['Calculus', 'Linear Algebra'],
    sharedSkills: ['Calculus'],
    photoUrl: '',
    activityScore: 88,
  },
];

describe('FindMate Component', () => {
  let mockFollowMutateAsync;

  beforeEach(() => {
    vi.clearAllMocks();

    mockFollowMutateAsync = vi.fn().mockResolvedValue({});

    authContext.useAuth.mockReturnValue({
      user: mockCurrentUser,
    });

    peerHooks.usePeerMatches.mockReturnValue({
      data: { data: mockMatches },
      isLoading: false,
      isError: false,
    });

    peerHooks.useFollowing.mockReturnValue({
      data: { data: [] },
      isLoading: false,
    });

    peerHooks.useMetadataOptions.mockReturnValue({
      data: {
        colleges: ['IIT Madras', 'BITS Pilani'],
        departments: ['Computer Science', 'Electrical Engineering'],
        skills: ['Data Structures', 'Calculus'],
      },
      isLoading: false,
    });

    peerHooks.useSearchUsers.mockImplementation((query) => {
      if (query && query.toLowerCase().includes('calculus')) {
        return {
          data: { data: [mockMatches[1]] },
          isLoading: false,
        };
      }
      return {
        data: { data: [] },
        isLoading: false,
      };
    });

    peerHooks.useFollowUser.mockReturnValue({
      mutateAsync: mockFollowMutateAsync,
      isPending: false,
    });
  });

  const renderComponent = () =>
    render(
      <MemoryRouter>
        <FindMate />
      </MemoryRouter>,
    );

  it('renders peer match cards with user details, rating, and skills', () => {
    renderComponent();

    // Verify main header
    expect(screen.getByRole('heading', { level: 1, name: /find a mate/i })).toBeInTheDocument();
    expect(screen.getByText(/discover peers who can help you grow/i)).toBeInTheDocument();

    // Verify peer names render
    expect(screen.getByText('Siddharth Rao')).toBeInTheDocument();
    expect(screen.getByText('Ananya Sharma')).toBeInTheDocument();

    // Verify colleges / departments render
    expect(screen.getByText(/IIT Madras/i)).toBeInTheDocument();
    expect(screen.getByText(/BITS Pilani/i)).toBeInTheDocument();

    // Verify ratings render
    expect(screen.getByText('4.8')).toBeInTheDocument();
    expect(screen.getByText('4.9')).toBeInTheDocument();

    // Verify skill tags render
    expect(screen.getByText('Data Structures')).toBeInTheDocument();
    expect(screen.getByText('Calculus')).toBeInTheDocument();

    // Verify follow buttons render
    const followButtons = screen.getAllByRole('button', { name: /^follow$/i });
    expect(followButtons.length).toBeGreaterThanOrEqual(2);
  });

  it('handles search input text and filters peer matches', async () => {
    renderComponent();

    const searchInput = screen.getByPlaceholderText(/search by topic, name, or college\.\.\./i);
    expect(searchInput).toBeInTheDocument();

    // Type "Calculus" and submit form
    fireEvent.change(searchInput, { target: { value: 'Calculus' } });
    expect(searchInput.value).toBe('Calculus');

    fireEvent.submit(searchInput.closest('form'));

    // Should query useSearchUsers with "Calculus"
    await waitFor(() => {
      expect(peerHooks.useSearchUsers).toHaveBeenCalledWith('Calculus');
    });

    // Should display matching searched peer
    await waitFor(() => {
      expect(screen.getByText('Ananya Sharma')).toBeInTheDocument();
    });
  });
});
