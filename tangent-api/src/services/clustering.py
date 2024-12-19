import os
import hdbscan
import numpy as np
from services.topic_generation import generate_topic_for_cluster
from sklearn.base import defaultdict


def perform_clustering(distance_matrix, n_points):
    """Perform clustering with proper error handling"""
    try:
        min_cluster_size = min(2, n_points - 1)
        clusterer = hdbscan.HDBSCAN(
            min_cluster_size=min_cluster_size,
            min_samples=1,
            metric="precomputed",
            cluster_selection_epsilon=0.3,
            cluster_selection_method="leaf",
            prediction_data=False,
        )

        clusters = clusterer.fit_predict(distance_matrix)

        # Handle outliers
        outlier_mask = clusters == -1
        if np.any(outlier_mask):
            clusters = handle_outliers(clusters, distance_matrix)

        return clusters

    except Exception as e:
        raise Exception(f"Clustering failed: {str(e)}")


GENERATION_MODEL = os.getenv("GENERATION_MODEL", "qwen2.5-coder:7b")


def generate_cluster_metadata(clusters, chat_titles, distance_matrix):
    """Generate metadata for each cluster including topics and coherence scores"""
    # Group titles by cluster
    cluster_titles = defaultdict(list)
    for title, cluster_id in zip(chat_titles, clusters):
        cluster_titles[cluster_id].append(title)

    # Generate metadata for each cluster
    cluster_metadata = {}
    for cluster_id, titles in cluster_titles.items():
        # Generate topic label for cluster
        topic = generate_topic_for_cluster(titles)

        # Calculate coherence score based on pairwise distances
        cluster_indices = np.where(clusters == cluster_id)[0]
        coherence = 1.0  # Default for single-point clusters

        if len(cluster_indices) > 1:
            # Calculate average pairwise similarity within cluster
            cluster_distances = distance_matrix[cluster_indices][:, cluster_indices]
            coherence = np.mean(
                [
                    1 - cluster_distances[i, j]
                    for i in range(len(cluster_indices))
                    for j in range(i + 1, len(cluster_indices))
                ]
            )

        cluster_metadata[str(cluster_id)] = {
            "topic": topic,
            "size": len(titles),
            "coherence": float(coherence),  # Ensure coherence is JSON serializable
            "reflection": "",  # Initialize empty reflection that can be populated later
        }

    return cluster_metadata


def handle_outliers(clusters, distance_matrix):
    """Handle outlier points in clustering"""
    outlier_indices = np.where(clusters == -1)[0]
    valid_clusters = np.unique(clusters[clusters != -1])

    for idx in outlier_indices:
        if len(valid_clusters) > 0:
            distances_to_clusters = {}
            for valid_cluster in valid_clusters:
                cluster_points = clusters == valid_cluster
                avg_distance = np.mean(distance_matrix[idx, cluster_points])
                distances_to_clusters[valid_cluster] = avg_distance

            nearest_cluster = min(distances_to_clusters.items(), key=lambda x: x[1])[0]
            clusters[idx] = nearest_cluster
        else:
            new_cluster = max(clusters) + 1 if len(clusters) > 0 else 0
            clusters[idx] = new_cluster

    return clusters
