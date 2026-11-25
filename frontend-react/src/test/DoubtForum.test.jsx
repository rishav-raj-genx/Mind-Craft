import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import DoubtForum from '../pages/DoubtForum';
import * as doubtHooks from '../hooks/useDoubtForum';
import * as authContext from '../context/AuthContext';
import * as notifContext from '../context/NotificationContext';

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../context/NotificationContext', () => ({
  useNotifications: vi.fn(),
}));

vi.mock('../hooks/useDoubtForum', () => ({
  useDoubts: vi.fn(),
  useCreateDoubt: vi.fn(),
  useAddAnswer: vi.fn(),
  useResolveDoubt: vi.fn(),
  useToggleDoubtUpvote: vi.fn(),
  useAcceptAnswer: vi.fn(),
}));

vi.mock('../services/voiceService', () => ({
  voiceService: {
    search: vi.fn(),
  },
}));

const mockUser = {
  uid: 'user-caller-123',
  id: 'user-caller-123',
  name: 'Test Student',
  email: 'student@example.com',
};

const mockDoubts = [
  {
    id: 'doubt-1',
    title: 'How does Dijkstra algorithm handle negative edge weights?',
    content: 'Need help understanding why priority queue Dijkstra fails with negative edges.',
    tag: '#DSA',
    createdAt: Date.now() - 3600000,
    author: {
      id: 'author-1',
      name: 'Alice Turing',
      clerkUserId: 'clerk-alice',
      photoUrl: '',
    },
    upvotes: 5,
    hasUpvoted: false,
    answers: [],
    status: 'OPEN',
    images: [],
  },
  {
    id: 'doubt-2',
    title: 'Intuition behind Matrix Eigenvectors',
    content: 'Can someone explain the geometric interpretation of characteristic polynomials?',
    tag: '#Math',
    createdAt: Date.now() - 7200000,
    author: {
      id: 'author-2',
      name: 'Bob Gauss',
      clerkUserId: 'clerk-bob',
      photoUrl: '',
    },
    upvotes: 3,
    hasUpvoted: true,
    answers: [],
    status: 'OPEN',
    images: [],
  },
];

describe('DoubtForum Component', () => {
  let mockCreateDoubtMutateAsync;

  beforeEach(() => {
    vi.clearAllMocks();

    authContext.useAuth.mockReturnValue({
      user: mockUser,
      markForumVisited: vi.fn(),
    });

    notifContext.useNotifications.mockReturnValue({
      addNotification: vi.fn(),
    });

    mockCreateDoubtMutateAsync = vi.fn().mockResolvedValue({ id: 'doubt-new-1' });

    doubtHooks.useDoubts.mockImplementation((filter) => {
      if (filter === '#DSA') {
        return {
          data: { data: [mockDoubts[0]] },
          isLoading: false,
          isError: false,
          refetch: vi.fn(),
        };
      }
      return {
        data: { data: mockDoubts },
        isLoading: false,
        isError: false,
        refetch: vi.fn(),
      };
    });

    doubtHooks.useCreateDoubt.mockReturnValue({
      mutateAsync: mockCreateDoubtMutateAsync,
      isPending: false,
    });

    doubtHooks.useAddAnswer.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });

    doubtHooks.useResolveDoubt.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });

    doubtHooks.useToggleDoubtUpvote.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });

    doubtHooks.useAcceptAnswer.mockReturnValue({
      mutateAsync: vi.fn(),
      isPending: false,
    });
  });

  const renderComponent = () =>
    render(
      <MemoryRouter>
        <DoubtForum />
      </MemoryRouter>,
    );

  it('renders forum header, filter tags, and doubt feed cards', () => {
    renderComponent();

    expect(screen.getByRole('heading', { level: 1, name: /doubt forum/i })).toBeInTheDocument();
    expect(screen.getByText(/ask questions · get answers from peers/i)).toBeInTheDocument();

    // Verify filter tabs render
    expect(screen.getByRole('button', { name: 'All Doubts' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'My Doubts' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '#DSA' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '#Math' })).toBeInTheDocument();

    // Verify doubt posts render
    expect(
      screen.getByText('How does Dijkstra algorithm handle negative edge weights?'),
    ).toBeInTheDocument();
    expect(
      screen.getByText('Intuition behind Matrix Eigenvectors'),
    ).toBeInTheDocument();
  });

  it('switches filter tab and queries filtered doubts', async () => {
    renderComponent();

    const dsaFilterButton = screen.getByRole('button', { name: '#DSA' });
    fireEvent.click(dsaFilterButton);

    await waitFor(() => {
      expect(doubtHooks.useDoubts).toHaveBeenCalledWith('#DSA');
    });
  });

  it('opens ask doubt modal and submits new question successfully', async () => {
    renderComponent();

    // Click FAB to open modal
    const askButton = screen.getByRole('button', { name: /ask a doubt/i });
    fireEvent.click(askButton);

    // Modal should be visible
    expect(screen.getByRole('heading', { level: 2, name: 'Ask a Doubt' })).toBeInTheDocument();

    // Fill title
    const titleInput = screen.getByPlaceholderText(/e\.g\. Confused about Red-Black trees\.\.\./i);
    fireEvent.change(titleInput, { target: { value: 'How does quicksort partition work?' } });

    // Fill content
    const contentTextarea = screen.getByPlaceholderText(/Explain what you're struggling with/i);
    fireEvent.change(contentTextarea, {
      target: { value: 'I want to understand Lomuto vs Hoare partition schemes.' },
    });

    // Select DSA topic
    const dsaTagBtn = document.getElementById('tag-DSA');
    fireEvent.click(dsaTagBtn);

    // Submit form
    const submitBtn = screen.getByRole('button', { name: /post doubt/i });
    fireEvent.click(submitBtn);

    await waitFor(() => {
      expect(mockCreateDoubtMutateAsync).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'How does quicksort partition work?',
          content: 'I want to understand Lomuto vs Hoare partition schemes.',
          tag: '#DSA',
        }),
      );
    });

    // Modal should close and success toast appears
    await waitFor(() => {
      expect(screen.getByText(/your doubt was posted!/i)).toBeInTheDocument();
    });
  });
});
