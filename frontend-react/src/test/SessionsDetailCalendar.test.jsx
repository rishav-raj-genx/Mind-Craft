import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import SessionsDetail from '../pages/SessionsDetail';
import { sessionService } from '../services/sessionService';
import * as authContext from '../context/AuthContext';

vi.mock('../context/AuthContext', () => ({
  useAuth: vi.fn(),
}));

vi.mock('../services/sessionService', () => ({
  sessionService: {
    getSessions: vi.fn(),
    exportToCalendar: vi.fn(),
    complete: vi.fn(),
    cancel: vi.fn(),
    acceptSession: vi.fn(),
    rejectSession: vi.fn(),
    reschedule: vi.fn(),
    rate: vi.fn(),
  },
}));

describe('Gate #7: SessionsDetail Add to Google Calendar button', () => {
  const mockUser = {
    uid: 'user-learner-1',
    id: 'user-learner-1',
    name: 'Learner One',
    email: 'learner@example.com',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    authContext.useAuth.mockReturnValue({ currentUser: mockUser });
    sessionService.getSessions.mockResolvedValue({
      success: true,
      data: [
        {
          sessionId: 'sess-cal-123',
          teacherUid: 'user-teacher-1',
          learnerUid: 'user-learner-1',
          peerName: 'Dr. Turing',
          skill: 'Graph Algorithms',
          status: 'UPCOMING',
          mode: 'Online',
          scheduledAt: Date.now() + 86400000,
          duration: 60,
        },
      ],
    });
  });

  it('opens the returned Google Calendar template URL without throwing', async () => {
    const calendarUrl =
      'https://calendar.google.com/calendar/render?action=TEMPLATE&text=MindCraft+Session%3A+Graph+Algorithms&dates=20261201T100000Z%2F20261201T110000Z&location=https%3A%2F%2Fmeet.jit.si%2FMindCraft-sess-cal-123';
    sessionService.exportToCalendar.mockResolvedValue({
      success: true,
      data: {
        htmlLink: calendarUrl,
        meetLink: 'https://meet.jit.si/MindCraft-sess-cal-123',
      },
    });

    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    render(
      <MemoryRouter>
        <SessionsDetail />
      </MemoryRouter>,
    );

    const addButton = await screen.findByRole('button', { name: /Add to Calendar/i });
    fireEvent.click(addButton);

    await waitFor(() => {
      expect(sessionService.exportToCalendar).toHaveBeenCalledWith('sess-cal-123');
      expect(openSpy).toHaveBeenCalledWith(calendarUrl, '_blank', 'noopener,noreferrer');
    });

    openSpy.mockRestore();
  });
});
