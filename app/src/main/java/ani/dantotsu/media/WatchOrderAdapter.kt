package ani.dantotsu.media

import android.content.Intent
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.RecyclerView
import ani.dantotsu.databinding.ItemWatchOrderBinding
import ani.dantotsu.loadImage
import ani.dantotsu.setSafeOnClickListener
import ani.dantotsu.snackString

class WatchOrderAdapter(
    private var items: List<WatchOrderNode> = emptyList()
) : RecyclerView.Adapter<WatchOrderAdapter.ViewHolder>() {

    fun submitList(newItems: List<WatchOrderNode>) {
        items = newItems
        notifyDataSetChanged()
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemWatchOrderBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        val node = items[position]
        holder.bind(node, position + 1)
    }

    override fun getItemCount(): Int = items.size

    inner class ViewHolder(private val binding: ItemWatchOrderBinding) : RecyclerView.ViewHolder(binding.root) {
        fun bind(node: WatchOrderNode, position: Int) {
            binding.itemWatchOrderPosition.text = position.toString()
            binding.itemWatchOrderTitle.text = node.title
            
            if (node.coverUrl != null) {
                binding.itemWatchOrderImage.loadImage(node.coverUrl)
            }
            
            binding.itemWatchOrderSubtitle.text = node.formatYear
            
            // Check for recap/summary tags or title names
            var badgeText: String? = null
            if (node.title.contains("Recap", ignoreCase = true)) {
                badgeText = "Recap"
            } else if (node.title.contains("Summary", ignoreCase = true)) {
                badgeText = "Summary"
            } else if (node.title.contains("Skippable", ignoreCase = true)) {
                badgeText = "Skippable"
            }

            if (badgeText != null) {
                binding.itemWatchOrderBadgeCard.visibility = View.VISIBLE
                binding.itemWatchOrderBadge.text = badgeText
            } else {
                binding.itemWatchOrderBadgeCard.visibility = View.GONE
            }

            // Since we don't have userStatus initially, hide the checkmark
            binding.itemWatchOrderCheck.visibility = View.GONE

            binding.root.setSafeOnClickListener {
                if (node.anilistId != null) {
                    ContextCompat.startActivity(
                        binding.root.context,
                        Intent(binding.root.context, MediaDetailsActivity::class.java).apply {
                            putExtra("mediaId", node.anilistId)
                        },
                        null
                    )
                } else {
                    snackString("AniList ID not found for this anime.")
                }
            }
        }
    }
}
