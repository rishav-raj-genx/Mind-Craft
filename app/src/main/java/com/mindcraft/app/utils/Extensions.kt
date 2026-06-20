/**
 * Extensions.kt — Useful Kotlin extension functions
 *
 * Contains extension functions that make common operations more concise
 * throughout the app, like formatting timestamps and toggling visibility.
 */
package com.mindcraft.app.utils

import android.view.View
import android.widget.ImageView
import com.bumptech.glide.Glide
import com.mindcraft.app.R
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Converts a timestamp (millis since epoch) to a readable date string.
 * Example: 1700000000000 → "Nov 14, 2023"
 */
fun Long.toDateString(): String {
    val dateFormat = SimpleDateFormat("MMM dd, yyyy", Locale.getDefault())
    return dateFormat.format(Date(this))
}

/**
 * Converts a timestamp to a readable time string.
 * Example: 1700000000000 → "3:30 PM"
 */
fun Long.toTimeString(): String {
    val timeFormat = SimpleDateFormat("h:mm a", Locale.getDefault())
    return timeFormat.format(Date(this))
}

/**
 * Converts a timestamp to a readable date and time string.
 * Example: 1700000000000 → "Nov 14, 2023 at 3:30 PM"
 */
fun Long.toDateTimeString(): String {
    val format = SimpleDateFormat("MMM dd, yyyy 'at' h:mm a", Locale.getDefault())
    return format.format(Date(this))
}

/**
 * Converts a timestamp to a short time-ago format for chat list.
 * Shows "Just now", "5m ago", "2h ago", or the date.
 */
fun Long.toRelativeTimeString(): String {
    val now = System.currentTimeMillis()
    val diff = now - this

    return when {
        diff < 60 * 1000 -> "Just now"
        diff < 60 * 60 * 1000 -> "${diff / (60 * 1000)}m ago"
        diff < 24 * 60 * 60 * 1000 -> "${diff / (60 * 60 * 1000)}h ago"
        else -> this.toDateString()
    }
}

/**
 * Makes a view visible (View.VISIBLE)
 */
fun View.show() {
    visibility = View.VISIBLE
}

/**
 * Makes a view invisible (View.GONE — takes no space)
 */
fun View.hide() {
    visibility = View.GONE
}

/**
 * Makes a view invisible but keeps its space (View.INVISIBLE)
 */
fun View.invisible() {
    visibility = View.INVISIBLE
}

/**
 * Loads an image URL into an ImageView using Glide with a placeholder.
 * Handles null/empty URLs gracefully by showing the placeholder.
 *
 * @param url The image URL to load
 */
fun ImageView.loadProfileImage(url: String?) {
    Glide.with(this.context)
        .load(url)
        .placeholder(R.drawable.ic_placeholder_profile)
        .error(R.drawable.ic_placeholder_profile)
        .circleCrop()
        .into(this)
}
