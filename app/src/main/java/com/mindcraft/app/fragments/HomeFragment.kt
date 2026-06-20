/**
 * HomeFragment.kt — Home screen with dummy map and nearby peers list
 *
 * This is the main screen of the app. It displays:
 * 1. A dummy map placeholder (replace with Google Maps when API key is ready)
 * 2. A bottom sheet with a filterable list of nearby peers from Firestore
 */
package com.mindcraft.app.fragments

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.util.Log
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.Toast
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.lifecycle.ViewModelProvider
import androidx.recyclerview.widget.LinearLayoutManager
import com.google.android.gms.location.FusedLocationProviderClient
import com.google.android.gms.location.LocationServices
import com.mindcraft.app.R
import com.mindcraft.app.activities.MyProfileActivity
import com.mindcraft.app.activities.PeerProfileActivity
import com.mindcraft.app.adapters.PeerCardAdapter
import com.mindcraft.app.databinding.FragmentHomeBinding
import com.mindcraft.app.utils.Constants
import com.mindcraft.app.utils.hide
import com.mindcraft.app.utils.loadProfileImage
import com.mindcraft.app.utils.show
import com.mindcraft.app.viewmodels.HomeViewModel
import com.mindcraft.app.viewmodels.MatchType
import com.mindcraft.app.viewmodels.PeerWithMatchType

class HomeFragment : Fragment() {

    // View binding
    private var _binding: FragmentHomeBinding? = null
    private val binding get() = _binding!!

    // ViewModel
    private lateinit var homeViewModel: HomeViewModel

    // Location provider
    private lateinit var fusedLocationClient: FusedLocationProviderClient

    // RecyclerView adapter for peer cards
    private lateinit var peerAdapter: PeerCardAdapter

    // All loaded peers (for filtering)
    private var allPeers = listOf<PeerWithMatchType>()

    // Permission launcher for location
    private val locationPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        val fineGranted = permissions[Manifest.permission.ACCESS_FINE_LOCATION] ?: false
        val coarseGranted = permissions[Manifest.permission.ACCESS_COARSE_LOCATION] ?: false

        if (fineGranted || coarseGranted) {
            getCurrentLocation()
        } else {
            Toast.makeText(requireContext(), getString(R.string.location_permission_needed), Toast.LENGTH_LONG).show()
        }
    }

    override fun onCreateView(inflater: LayoutInflater, container: ViewGroup?, savedInstanceState: Bundle?): View {
        _binding = FragmentHomeBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        // Initialize ViewModel
        homeViewModel = ViewModelProvider(this)[HomeViewModel::class.java]

        // Initialize location client
        fusedLocationClient = LocationServices.getFusedLocationProviderClient(requireActivity())

        // Set up the peer list RecyclerView
        setupPeerList()

        // Set up filter chips
        setupFilterChips()

        // Set up profile photo click
        setupProfileClick()

        // Observe ViewModel data
        observeViewModel()

        // Load current user data
        homeViewModel.loadCurrentUser()

        // Check location permission and get location
        checkLocationPermission()
    }

    /**
     * Sets up the RecyclerView with the PeerCardAdapter.
     */
    private fun setupPeerList() {
        peerAdapter = PeerCardAdapter { peerWithMatch ->
            openPeerProfile(peerWithMatch.user.uid)
        }

        binding.rvPeers.apply {
            layoutManager = LinearLayoutManager(requireContext())
            adapter = peerAdapter
        }
    }

    /**
     * Sets up filter chip click listeners to filter the peer list.
     */
    private fun setupFilterChips() {
        binding.chipAll.setOnClickListener { filterPeers(null) }
        binding.chipPerfect.setOnClickListener { filterPeers(MatchType.PERFECT) }
        binding.chipPartial.setOnClickListener { filterPeers(MatchType.PARTIAL) }
        binding.chipSameCollege.setOnClickListener { filterPeers(MatchType.SAME_COLLEGE) }
    }

    /**
     * Filters the peer list by match type.
     */
    private fun filterPeers(matchType: MatchType?) {
        val filtered = if (matchType == null) {
            allPeers
        } else {
            allPeers.filter { it.matchType == matchType }
        }
        peerAdapter.submitList(filtered)
        updateEmptyState(filtered.isEmpty())
    }

    /**
     * Sets up the profile photo click to navigate to My Profile.
     */
    private fun setupProfileClick() {
        binding.ivMyProfile.setOnClickListener {
            val intent = Intent(requireContext(), MyProfileActivity::class.java)
            startActivity(intent)
        }
    }

    /**
     * Checks if location permission is granted, and requests it if not.
     */
    private fun checkLocationPermission() {
        val fineLocation = ContextCompat.checkSelfPermission(
            requireContext(), Manifest.permission.ACCESS_FINE_LOCATION
        )

        if (fineLocation == PackageManager.PERMISSION_GRANTED) {
            getCurrentLocation()
        } else {
            locationPermissionLauncher.launch(
                arrayOf(
                    Manifest.permission.ACCESS_FINE_LOCATION,
                    Manifest.permission.ACCESS_COARSE_LOCATION
                )
            )
        }
    }

    /**
     * Gets the user's current location using FusedLocationProviderClient.
     * No Google Map — we just use location to load nearby peers from Firestore.
     */
    private fun getCurrentLocation() {
        try {
            fusedLocationClient.lastLocation.addOnSuccessListener { location ->
                if (location != null) {
                    // Update location in Firestore
                    homeViewModel.updateLocation(location.latitude, location.longitude)

                    // Load nearby peers based on current location
                    homeViewModel.loadNearbyPeers(location.latitude, location.longitude)
                } else {
                    // Use a default location if GPS not available (e.g. emulator)
                    Log.d(Constants.LOG_TAG, "Location is null, using default")
                    homeViewModel.loadNearbyPeers(0.0, 0.0)
                }
            }
        } catch (e: SecurityException) {
            Log.d(Constants.LOG_TAG, "Location permission missing: ${e.message}")
        }
    }

    /**
     * Observes ViewModel LiveData for UI updates.
     */
    private fun observeViewModel() {
        // Observe current user for profile photo
        homeViewModel.currentUser.observe(viewLifecycleOwner) { user ->
            user?.let {
                binding.ivMyProfile.loadProfileImage(it.photoUrl)
            }
        }

        // Observe nearby peers
        homeViewModel.nearbyPeers.observe(viewLifecycleOwner) { peers ->
            allPeers = peers
            peerAdapter.submitList(peers)
            binding.tvPeerCount.text = peers.size.toString()
            updateEmptyState(peers.isEmpty())
        }

        // Observe loading state
        homeViewModel.isLoading.observe(viewLifecycleOwner) { loading ->
            if (loading) binding.progressBar.show() else binding.progressBar.hide()
        }
    }

    /**
     * Shows or hides the empty state view.
     */
    private fun updateEmptyState(isEmpty: Boolean) {
        if (isEmpty) {
            binding.emptyStateView.show()
            binding.rvPeers.hide()
        } else {
            binding.emptyStateView.hide()
            binding.rvPeers.show()
        }
    }

    /**
     * Opens the PeerProfileActivity for a given peer.
     */
    private fun openPeerProfile(peerUid: String) {
        val intent = Intent(requireContext(), PeerProfileActivity::class.java)
        intent.putExtra("peerUid", peerUid)
        startActivity(intent)
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
