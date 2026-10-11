package ani.dantotsu.others

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.jsoup.Jsoup
import ani.dantotsu.media.WatchOrderNode
import ani.dantotsu.util.Logger

object ChiakiScraper {
    private const val USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36"
    
    /**
     * Scrapes Chiaki.site for the watch order given a MAL ID.
     * Extracts AniList IDs directly if available.
     * Returns a list of AniList IDs in watch order.
     */
    suspend fun getWatchOrder(malId: Int): List<WatchOrderNode> = withContext(Dispatchers.IO) {
        var attempts = 0
        val maxAttempts = 3
        
        while (attempts < maxAttempts) {
            try {
                val url = "https://chiaki.site/?/tools/watch_order/id/$malId"
                val doc = Jsoup.connect(url)
                    .userAgent(USER_AGENT)
                    .timeout(5000)
                    .get()

                val nodes = mutableListOf<WatchOrderNode>()
                
                // Chiaki stores each anime entry in a td with class uk-text-middle
                val items = doc.select("td.uk-text-middle")
                
                for (item in items) {
                    val title = item.selectFirst(".wo_title")?.text() ?: continue
                    
                    val metaText = item.selectFirst(".wo_meta")?.text() ?: ""
                    val parts = metaText.split("|").map { it.trim() }
                    val format = parts.getOrNull(1) ?: ""
                    if (format.equals("Music", ignoreCase = true)) {
                        continue
                    }
                    val datePart = parts.getOrNull(0) ?: ""
                    val year = Regex("""\b(19|20)\d{2}\b""").find(datePart)?.value ?: ""
                    val formatYear = listOf(format, year).filter { it.isNotEmpty() }.joinToString(" • ")
                    
                    val malLink = item.selectFirst("a[href^=https://myanimelist.net/anime/]")?.attr("href")
                    val currentMalId = malLink?.substringAfter("anime/")?.substringBefore("/")?.toIntOrNull()
                    
                    val anilistLink = item.selectFirst("a[href^=https://anilist.co/anime/]")?.attr("href")
                    val currentAnilistId = anilistLink?.substringAfter("anime/")?.substringBefore("/")?.toIntOrNull()
                    
                    var coverUrl: String? = null
                    if (currentMalId != null) {
                        // The avatar div has a style attribute like: background-image:url('media/a/04/5.jpg')
                        val avatarDiv = doc.selectFirst("div.wo_avatar[style*=/$currentMalId.jpg]")
                        val style = avatarDiv?.attr("style")
                        val relativeUrl = style?.substringAfter("url('")?.substringBefore("')")
                        if (relativeUrl != null) {
                            coverUrl = "https://chiaki.site/$relativeUrl"
                        }
                    }
                    
                    // Fallback image if we couldn't find the Chiaki one (rare)
                    if (coverUrl == null && currentAnilistId != null) {
                        coverUrl = "https://s4.anilist.co/file/anilistcdn/media/anime/cover/large/nx$currentAnilistId.jpg"
                    }
                    
                    if (nodes.none { it.malId == currentMalId }) {
                        nodes.add(
                            WatchOrderNode(
                                title = title,
                                coverUrl = coverUrl,
                                formatYear = formatYear,
                                malId = currentMalId,
                                anilistId = currentAnilistId
                            )
                        )
                    }
                }
                
                if (nodes.isNotEmpty()) {
                    return@withContext nodes
                }
                
            } catch (e: Exception) {
                Logger.log("ChiakiScraper failed attempt ${attempts + 1}: ${e.message}")
                attempts++
            }
        }
        
        return@withContext emptyList()
    }
}
