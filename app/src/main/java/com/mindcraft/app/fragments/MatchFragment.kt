/**
 * MatchFragment.kt — Match feed screen with 3 tabs
 *
 * Displays:
 * - Discover: New peers matching your skills
 * - Requests: Incoming match requests
 * - My Matches: Confirmed matches with chat access
 */
package com.mindcraft.app.fragments

import android.content.Intent
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
import com.mindcraft.app.activities.ChatActivity
import com.mindcraft.app.activities.PeerProfileActivity
import com.mindcraft.app.adapters.MatchAdapter
import com.mindcraft.app.adapters.MatchCardMode
import com.mindcraft.app.databinding.FragmentMatchBinding
import com.mindcraft.app.model.Match
import com.mindcraft.app.model.MatchRequest
import com.mindcraft.app.model.User
import com.mindcraft.app.utils.hide
import com.mindcraft.app.utils.show
import com.mindcraft.app.viewmodels.MatchViewModel

class MatchFragment : Fragment() {

    private var _binding: FragmentMatchBinding? = null
    private val binding get() = _binding!!

    private lateinit var matchViewModel: MatchViewModel

    // Separate adapters for each tab
    private lateinit var discoverAdapter: MatchAdapter
    private lateinit var requestsAdapter: MatchAdapter
    private lateinit var myMatchesAdapter: MatchAdapter

    // Store request objects for accept/decline (keyed by fromUid)
    private val requestMap = mutableMapOf<String, MatchRequest>()

    // Store confirmed matches for opening chat (keyed by peer uid)
    private val matchMap = mutableMapOf<String, Match>()

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentMatchBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        matchViewModel = ViewModelProvider(this)[MatchViewModel::class.java]

        setupTabs()
        setupAdapters()
        observeViewModel()
        matchViewModel.loadAllMatchData()
    }

    /**
     * Sets up the tab layout with 3 tabs.
     */
    private fun setupTabs() {
        binding.tabLayout.addTab(binding.tabLayout.newTab().setText(getString(R.string.discover)))
        binding.tabLayout.addTab(binding.tabLayout.newTab().setText(getString(R.string.requests)))
        binding.tabLayout.addTab(binding.tabLayout.newTab().setText(getString(R.string.my_matches)))

        binding.tabLayout.addOnTabSelectedListener(object : TabLayout.OnTabSelectedListener {
            override fun onTabSelected(tab: TabLayout.Tab) {
                binding.viewFlipper.displayedChild = tab.position
            }
            override fun onTabUnselected(tab: TabLayout.Tab) {}
            override fun onTabReselected(tab: TabLayout.Tab) {}
        })
    }

    /**
     * Sets up adapters for all 3 RecyclerViews.
     */
    private fun setupAdapters() {
        // Discover adapter — "Connect" button
        discoverAdapter = MatchAdapter(
            mode = MatchCardMode.DISCOVER,
            onViewProfile = { user -> openPeerProfile(user.uid) },
            onActionClick = { user, skill -> matchViewModel.sendMatchRequest(user.uid, skill) }
        )

        // Requests adapter — "Accept" / "Decline" buttons
        requestsAdapter = MatchAdapter(
            mode = MatchCardMode.REQUEST,
            onViewProfile = { user -> openPeerProfile(user.uid) },
            onActionClick = { user, action -> handleRequestAction(user, action) }
        )

        // My Matches adapter — "Open Chat" button
        myMatchesAdapter = MatchAdapter(
            mode = MatchCardMode.MY_MATCH,
            onViewProfile = { user -> openPeerProfile(user.uid) },
            onActionClick = { user, _ -> openChat(user.uid) }
        )

        binding.rvDiscover.apply { layoutManager = LinearLayoutManager(requireContext()); adapter = discoverAdapter }
        binding.rvRequests.apply { layoutManager = LinearLayoutManager(requireContext()); adapter = requestsAdapter }
        binding.rvMyMatches.apply { layoutManager = LinearLayoutManager(requireContext()); adapter = myMatchesAdapter }
    }

    /**
     * Handles accept/decline actions on a match request.
     * FIX: Now actually calls acceptRequest() with the real MatchRequest object.
     */
    private fun handleRequestAction(user: User, action: String) {
        val request = requestMap[user.uid]
        if (request == null) {
            Toast.makeText(requireContext(), getString(R.string.error_occurred), Toast.LENGTH_SHORT).show()
            return
        }
        when (action) {
            "accept" -> matchViewModel.acceptRequest(request)
            "decline" -> matchViewModel.declineRequest(request.requestId)
        }
    }

    /**
     * Observes ViewModel LiveData.
     */
    private fun observeViewModel() {
        matchViewModel.discoveredMatches.observe(viewLifecycleOwner) { users ->
            discoverAdapter.submitList(users)
            if (users.isEmpty()) binding.emptyDiscover.show() else binding.emptyDiscover.hide()
        }

        matchViewModel.incomingRequests.observe(viewLifecycleOwner) { requests ->
            // FIX: Populate requestMap so accept/decline can find the MatchRequest object
            requestMap.clear()
            requests.forEach { request -> requestMap[request.fromUid] = request }

            if (requests.isEmpty()) binding.emptyRequests.show() else binding.emptyRequests.hide()
        }

        // FIX: Observe requestUsers to populate the requests RecyclerView
        matchViewModel.requestUsers.observe(viewLifecycleOwner) { users ->
            requestsAdapter.submitList(users)
        }

        matchViewModel.myMatches.observe(viewLifecycleOwner) { matches ->
            // FIX: Build matchMap so openChat can find the matchId
            matchMap.clear()
            val currentUid = matchViewModel.getCurrentUid() ?: ""
            matches.forEach { match ->
                val peerUid = if (match.user1Uid == currentUid) match.user2Uid else match.user1Uid
                matchMap[peerUid] = match
            }

            if (matches.isEmpty()) binding.emptyMyMatches.show() else binding.emptyMyMatches.hide()
        }

        // FIX: Observe matchUsers to populate the My Matches RecyclerView
        matchViewModel.matchUsers.observe(viewLifecycleOwner) { users ->
            myMatchesAdapter.submitList(users)
        }

        matchViewModel.actionResult.observe(viewLifecycleOwner) { result ->
            when (result) {
                "match_sent" -> Toast.makeText(requireContext(), getString(R.string.match_request_sent), Toast.LENGTH_SHORT).show()
                "request_accepted" -> Toast.makeText(requireContext(), getString(R.string.match_request_accepted), Toast.LENGTH_SHORT).show()
                "request_declined" -> Toast.makeText(requireContext(), getString(R.string.match_request_declined), Toast.LENGTH_SHORT).show()
                "error" -> Toast.makeText(requireContext(), getString(R.string.error_occurred), Toast.LENGTH_SHORT).show()
            }
            matchViewModel.resetActionResult()
        }

        matchViewModel.isLoading.observe(viewLifecycleOwner) { loading ->
            if (loading) binding.progressBar.show() else binding.progressBar.hide()
        }
    }

    private fun openPeerProfile(uid: String) {
        val intent = Intent(requireContext(), PeerProfileActivity::class.java)
        intent.putExtra("peerUid", uid)
        startActivity(intent)
    }

    /**
     * FIX: Now passes matchId to ChatActivity. Looks up the match for this peer.
     */
    private fun openChat(peerUid: String) {
        val match = matchMap[peerUid]
        val intent = Intent(requireContext(), ChatActivity::class.java)
        intent.putExtra("peerUid", peerUid)
        intent.putExtra("matchId", match?.matchId ?: "")
        startActivity(intent)
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
