package ani.dantotsu.others

import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import org.jsoup.Jsoup
import org.jsoup.nodes.Document
import org.jsoup.nodes.Element
import ani.dantotsu.util.Logger

object RedditScraper {
    private const val USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    private const val WIKI_URL = "https://old.reddit.com/r/anime/wiki/watch_order"
    
    private var cachedDocument: Document? = null
    private var cacheTimestamp: Long = 0L
    private const val CACHE_DURATION_MS = 24 * 60 * 60 * 1000L // 24 hours
    private val lock = Any()

    private suspend fun getWikiDocument(): Document? = withContext(Dispatchers.IO) {
        val now = System.currentTimeMillis()
        synchronized(lock) {
            if (cachedDocument != null && now - cacheTimestamp < CACHE_DURATION_MS) {
                return@withContext cachedDocument
            }
        }

        var attempts = 0
        val maxAttempts = 3
        while (attempts < maxAttempts) {
            try {
                val doc = Jsoup.connect(WIKI_URL)
                    .userAgent(USER_AGENT)
                    .timeout(15000)
                    .get()
                
                val title = doc.title()
                if (!title.contains("verification", ignoreCase = true) && doc.selectFirst("div.wiki-page-content, div.md.wiki") != null) {
                    synchronized(lock) {
                        cachedDocument = doc
                        cacheTimestamp = now
                    }
                    return@withContext doc
                } else {
                    Logger.log("RedditScraper verification page detected or content missing, retrying...")
                }
            } catch (e: Exception) {
                Logger.log("RedditScraper failed attempt ${attempts + 1}: ${e.message}")
            }
            attempts++
        }
        
        synchronized(lock) {
            if (cachedDocument != null) {
                return@withContext cachedDocument
            }
        }
        return@withContext null
    }

    suspend fun getWatchOrder(malId: Int): List<Int> {
        val doc = getWikiDocument() ?: return emptyList()
        return withContext(Dispatchers.Default) {
            try {
                val headings = doc.select("h1, h2, h3, h4, h5, h6")
                var bestHeading: Element? = null
                var bestScore = -1
                
                for (h in headings) {
                    var sibling = h.nextElementSibling()
                    var containsMalId = false
                    val headingLevel = h.tagName()[1].digitToInt()
                    
                    while (sibling != null) {
                        if (sibling.tagName().matches(Regex("h[1-6]"))) {
                            val level = sibling.tagName()[1].digitToInt()
                            if (level <= headingLevel) {
                                break
                            }
                        }
                        
                        if (sibling.selectFirst("a[href*=\"myanimelist.net/anime/$malId\"]") != null) {
                            containsMalId = true
                            break
                        }
                        
                        sibling = sibling.nextElementSibling()
                    }
                    
                    if (containsMalId) {
                        val text = (h.text() + " " + h.attr("id")).lowercase()
                        val score = when {
                            text.contains("chronological") -> 100
                            text.contains("novel") -> 50
                            text.contains("recommended") -> 40
                            text.contains("airing") -> 10
                            else -> 5
                        }
                        if (score > bestScore) {
                            bestScore = score
                            bestHeading = h
                        }
                    }
                }
                
                if (bestHeading != null) {
                    val malIds = mutableListOf<Int>()
                    var sibling = bestHeading.nextElementSibling()
                    val regex = Regex("""myanimelist\.net/anime/(\d+)""")
                    val headingLevel = bestHeading.tagName()[1].digitToInt()
                    
                    while (sibling != null) {
                        if (sibling.tagName().matches(Regex("h[1-6]"))) {
                            val level = sibling.tagName()[1].digitToInt()
                            if (level <= headingLevel) {
                                break
                            }
                        }
                        
                        val siblingLinks = sibling.select("a[href]")
                        for (l in siblingLinks) {
                            val href = l.attr("href")
                            regex.find(href)?.let { match ->
                                val id = match.groupValues[1].toInt()
                                malIds.add(id)
                            }
                        }
                        sibling = sibling.nextElementSibling()
                    }
                    return@withContext malIds.distinct()
                }
                
                return@withContext emptyList()
            } catch (e: Exception) {
                Logger.log("RedditScraper parsing error: ${e.message}")
                emptyList()
            }
        }
    }
}
