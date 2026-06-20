/**
 * LocationUtils.kt — Utility functions for distance calculations
 *
 * Contains the Haversine formula for calculating the great-circle distance
 * between two geographic points (latitude/longitude) on Earth.
 */
package com.mindcraft.app.utils

import com.mindcraft.app.model.User
import kotlin.math.*

object LocationUtils {

    // Earth's radius in kilometers
    private const val EARTH_RADIUS_KM = 6371.0

    /**
     * Calculates the distance in kilometers between two users using the
     * Haversine formula. This is the great-circle distance, which is the
     * shortest path between two points on a sphere.
     *
     * @param user1 The first user (typically the current user)
     * @param user2 The second user (a nearby peer)
     * @return Distance between the two users in kilometers
     */
    fun calculateDistanceKm(user1: User, user2: User): Double {
        return calculateDistanceKm(
            user1.latitude, user1.longitude,
            user2.latitude, user2.longitude
        )
    }

    /**
     * Calculates the distance in kilometers between two lat/lng points
     * using the Haversine formula.
     *
     * @param lat1 Latitude of point 1
     * @param lon1 Longitude of point 1
     * @param lat2 Latitude of point 2
     * @param lon2 Longitude of point 2
     * @return Distance in kilometers
     */
    fun calculateDistanceKm(
        lat1: Double, lon1: Double,
        lat2: Double, lon2: Double
    ): Double {
        // Convert latitude difference to radians
        val dLat = Math.toRadians(lat2 - lat1)
        // Convert longitude difference to radians
        val dLon = Math.toRadians(lon2 - lon1)

        // Haversine formula components
        val a = sin(dLat / 2).pow(2) +
                cos(Math.toRadians(lat1)) *
                cos(Math.toRadians(lat2)) *
                sin(dLon / 2).pow(2)

        val c = 2 * atan2(sqrt(a), sqrt(1 - a))

        // Distance = Earth's radius × central angle
        return EARTH_RADIUS_KM * c
    }

    /**
     * Rounds a coordinate to the specified number of decimal places
     * for location privacy. 2 decimal places ≈ 1.1 km accuracy.
     *
     * @param coordinate The latitude or longitude value
     * @param decimals Number of decimal places (default: 2)
     * @return Rounded coordinate
     */
    fun roundForPrivacy(coordinate: Double, decimals: Int = Constants.LOCATION_PRIVACY_DECIMALS): Double {
        val factor = 10.0.pow(decimals)
        return (coordinate * factor).roundToLong() / factor
    }

    /**
     * Calculates a bounding box around a center point for querying
     * nearby users. This is an approximation used for Firestore queries
     * (since Firestore doesn't support radius queries directly).
     *
     * @param centerLat Center latitude
     * @param centerLon Center longitude
     * @param radiusKm Radius in kilometers
     * @return A BoundingBox with min/max lat/lon values
     */
    fun getBoundingBox(centerLat: Double, centerLon: Double, radiusKm: Double): BoundingBox {
        // Rough approximation: 1 degree of latitude ≈ 111 km
        val latDelta = radiusKm / 111.0
        // 1 degree of longitude varies by latitude
        val lonDelta = radiusKm / (111.0 * cos(Math.toRadians(centerLat)))

        return BoundingBox(
            minLat = centerLat - latDelta,
            maxLat = centerLat + latDelta,
            minLon = centerLon - lonDelta,
            maxLon = centerLon + lonDelta
        )
    }

    /**
     * Formats a distance value as a human-readable string.
     *
     * @param distanceKm Distance in kilometers
     * @return Formatted string like "1.2" (km)
     */
    fun formatDistance(distanceKm: Double): String {
        return String.format("%.1f", distanceKm)
    }
}

/**
 * BoundingBox — Represents a geographic bounding box
 * Used for querying nearby users within a rectangular area.
 */
data class BoundingBox(
    val minLat: Double,
    val maxLat: Double,
    val minLon: Double,
    val maxLon: Double
)
