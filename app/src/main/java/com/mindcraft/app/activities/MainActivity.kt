/**
 * MainActivity.kt — Main screen that hosts bottom navigation
 *
 * This activity contains the BottomNavigationView with 4 tabs:
 * Home (map), Matches, Sessions, and Chat.
 * It uses the Navigation Component to switch between fragments.
 */
package com.mindcraft.app.activities

import android.os.Bundle
import androidx.appcompat.app.AppCompatActivity
import androidx.navigation.fragment.NavHostFragment
import androidx.navigation.ui.setupWithNavController
import com.mindcraft.app.R
import com.mindcraft.app.databinding.ActivityMainBinding

class MainActivity : AppCompatActivity() {

    // View binding for accessing layout views
    private lateinit var binding: ActivityMainBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)

        // Set up navigation with bottom nav bar
        setupNavigation()
    }

    /**
     * Connects the BottomNavigationView to the NavController.
     * This automatically handles fragment switching when tabs are tapped.
     */
    private fun setupNavigation() {
        // Get the NavHostFragment from the layout
        val navHostFragment = supportFragmentManager
            .findFragmentById(R.id.navHostFragment) as NavHostFragment

        // Get the NavController from the NavHostFragment
        val navController = navHostFragment.navController

        // Connect bottom navigation to the nav controller
        binding.bottomNavigation.setupWithNavController(navController)
    }
}
