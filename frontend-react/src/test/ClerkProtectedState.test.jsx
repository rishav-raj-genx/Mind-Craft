import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { SignedIn } from '@clerk/clerk-react';

vi.mock('@clerk/clerk-react', () => ({
  SignedIn: ({ children }) => <>{children}</>,
}));

describe('Clerk signed-in state', () => {
  it('renders authenticated content inside SignedIn', () => {
    render(
      <SignedIn>
        <span>Authenticated dashboard</span>
      </SignedIn>,
    );
    expect(screen.getByText('Authenticated dashboard')).toBeInTheDocument();
  });
});
