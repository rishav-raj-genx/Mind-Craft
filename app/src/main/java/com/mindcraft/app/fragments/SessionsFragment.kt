/**
 * SessionsFragment.kt — Sessions screen with 3 tabs
 *
 * Displays Upcoming, Completed, and Cancelled sessions.
 */
package com.mindcraft.app.fragments

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.fragment.app.Fragment
import androidx.lifecycle.ViewModelProvider
import androidx.recyclerview.widget.LinearLayoutManager
import com.google.android.material.tabs.TabLayout
import com.mindcraft.app.R
import com.mindcraft.app.adapters.SessionCardAdapter
import com.mindcraft.app.databinding.FragmentSessionsBinding
import com.mindcraft.app.utils.hide
import com.mindcraft.app.utils.show
import com.mindcraft.app.viewmodels.SessionViewModel

class SessionsFragment : Fragment() {

    private var _binding: FragmentSessionsBinding? = null
    private val binding get() = _binding!!

    private lateinit var sessionViewModel: SessionViewModel
    private lateinit var upcomingAdapter: SessionCardAdapter
    private lateinit var completedAdapter: SessionCardAdapter
    private lateinit var cancelledAdapter: SessionCardAdapter

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentSessionsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        sessionViewModel = ViewModelProvider(this)[SessionViewModel::class.java]
        setupTabs()
        setupAdapters()
        observeViewModel()
        sessionViewModel.loadAllSessions()
    }

    private fun setupTabs() {
        binding.tabLayout.addTab(binding.tabLayout.newTab().setText(getString(R.string.upcoming)))
        binding.tabLayout.addTab(binding.tabLayout.newTab().setText(getString(R.string.completed)))
        binding.tabLayout.addTab(binding.tabLayout.newTab().setText(getString(R.string.cancelled)))

        binding.tabLayout.addOnTabSelectedListener(object : TabLayout.OnTabSelectedListener {
            override fun onTabSelected(tab: TabLayout.Tab) { binding.viewFlipper.displayedChild = tab.position }
            override fun onTabUnselected(tab: TabLayout.Tab) {}
            override fun onTabReselected(tab: TabLayout.Tab) {}
        })
    }

    private fun setupAdapters() {
        upcomingAdapter = SessionCardAdapter(
            onCancelClick = { session -> sessionViewModel.cancelSession(session.sessionId) }
        )
        completedAdapter = SessionCardAdapter(
            onRateClick = { session ->
                // Show rating dialog (simplified — in production, use a bottom sheet)
                sessionViewModel.rateSession(session.sessionId, 5f, "Great!", session.teacherUid)
            }
        )
        cancelledAdapter = SessionCardAdapter()

        binding.rvUpcoming.apply { layoutManager = LinearLayoutManager(requireContext()); adapter = upcomingAdapter }
        binding.rvCompleted.apply { layoutManager = LinearLayoutManager(requireContext()); adapter = completedAdapter }
        binding.rvCancelled.apply { layoutManager = LinearLayoutManager(requireContext()); adapter = cancelledAdapter }
    }

    private fun observeViewModel() {
        sessionViewModel.upcomingSessions.observe(viewLifecycleOwner) { sessions ->
            upcomingAdapter.submitList(sessions)
            if (sessions.isEmpty()) binding.emptyUpcoming.show() else binding.emptyUpcoming.hide()
        }
        sessionViewModel.completedSessions.observe(viewLifecycleOwner) { sessions ->
            completedAdapter.submitList(sessions)
            if (sessions.isEmpty()) binding.emptyCompleted.show() else binding.emptyCompleted.hide()
        }
        sessionViewModel.cancelledSessions.observe(viewLifecycleOwner) { sessions ->
            cancelledAdapter.submitList(sessions)
            if (sessions.isEmpty()) binding.emptyCancelled.show() else binding.emptyCancelled.hide()
        }
        sessionViewModel.actionResult.observe(viewLifecycleOwner) { result ->
            when (result) {
                "session_booked" -> Toast.makeText(requireContext(), getString(R.string.session_booked), Toast.LENGTH_SHORT).show()
                "session_cancelled" -> Toast.makeText(requireContext(), getString(R.string.cancelled), Toast.LENGTH_SHORT).show()
                "rating_submitted" -> Toast.makeText(requireContext(), getString(R.string.rating_submitted), Toast.LENGTH_SHORT).show()
            }
            sessionViewModel.resetActionResult()
        }
        sessionViewModel.isLoading.observe(viewLifecycleOwner) { loading ->
            if (loading) binding.progressBar.show() else binding.progressBar.hide()
        }
    }

    override fun onDestroyView() { super.onDestroyView(); _binding = null }
}
