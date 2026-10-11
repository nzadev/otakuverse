package ani.dantotsu.media

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.activityViewModels
import androidx.recyclerview.widget.LinearLayoutManager
import ani.dantotsu.BottomSheetDialogFragment
import ani.dantotsu.databinding.BottomSheetWatchOrderBinding

class WatchOrderBottomSheet : BottomSheetDialogFragment() {
    private var _binding: BottomSheetWatchOrderBinding? = null
    private val binding get() = _binding!!

    private val model: MediaDetailsViewModel by activityViewModels()

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = BottomSheetWatchOrderBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        val title = arguments?.getString(ARG_TITLE) ?: "Watch Order"
        val mediaId = arguments?.getInt(ARG_MEDIA_ID) ?: 0
        val isRelease = arguments?.getBoolean(ARG_IS_RELEASE) ?: true

        val defaultColor = binding.watchOrderBottomSheetTitle.currentTextColor

        if (isRelease) {
            model.releaseWatchOrderSource.observe(viewLifecycleOwner) { source ->
                binding.watchOrderBottomSheetTitle.text = title
                val color = when {
                    source.equals("Chiaki", ignoreCase = true) -> android.graphics.Color.parseColor("#FF4081")
                    source.equals("Reddit", ignoreCase = true) -> android.graphics.Color.parseColor("#FF4500")
                    else -> defaultColor
                }
                binding.watchOrderBottomSheetTitle.setTextColor(color)
            }
        } else {
            model.recommendedWatchOrderSource.observe(viewLifecycleOwner) { source ->
                binding.watchOrderBottomSheetTitle.text = title
                val color = when {
                    source.equals("Chiaki", ignoreCase = true) -> android.graphics.Color.parseColor("#FF4081")
                    source.equals("Reddit", ignoreCase = true) -> android.graphics.Color.parseColor("#FF4500")
                    else -> defaultColor
                }
                binding.watchOrderBottomSheetTitle.setTextColor(color)
            }
        }

        val adapter = WatchOrderAdapter(emptyList())
        binding.watchOrderBottomSheetRecyclerView.layoutManager = LinearLayoutManager(requireContext())
        binding.watchOrderBottomSheetRecyclerView.adapter = adapter

        model.isLoadingWatchOrder.observe(viewLifecycleOwner) { isLoading ->
            binding.watchOrderBottomSheetProgressBar.visibility = if (isLoading) View.VISIBLE else View.GONE
            binding.watchOrderBottomSheetRecyclerView.visibility = if (isLoading) View.GONE else View.VISIBLE
        }

        if (isRelease) {
            model.releaseWatchOrder.observe(viewLifecycleOwner) { entries ->
                if (!entries.isNullOrEmpty()) {
                    adapter.submitList(entries)
                } else if (model.isLoadingWatchOrder.value != true) {
                    model.loadWatchOrder(mediaId)
                }
            }
        } else {
            model.recommendedWatchOrder.observe(viewLifecycleOwner) { entries ->
                if (!entries.isNullOrEmpty()) {
                    adapter.submitList(entries)
                } else if (model.isLoadingWatchOrder.value != true) {
                    model.loadWatchOrder(mediaId)
                }
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }

    companion object {
        private const val ARG_TITLE = "arg_title"
        private const val ARG_MEDIA_ID = "arg_media_id"
        private const val ARG_IS_RELEASE = "arg_is_release"

        fun newInstance(title: String, mediaId: Int, isRelease: Boolean): WatchOrderBottomSheet {
            val fragment = WatchOrderBottomSheet()
            val args = Bundle().apply {
                putString(ARG_TITLE, title)
                putInt(ARG_MEDIA_ID, mediaId)
                putBoolean(ARG_IS_RELEASE, isRelease)
            }
            fragment.arguments = args
            return fragment
        }
    }
}
