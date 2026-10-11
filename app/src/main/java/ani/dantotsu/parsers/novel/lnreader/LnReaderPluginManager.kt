package ani.dantotsu.parsers.novel.lnreader

import android.content.Context
import ani.dantotsu.settings.saving.PrefManager
import ani.dantotsu.settings.saving.PrefName
import ani.dantotsu.util.Logger
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.withContext
import org.json.JSONArray
import uy.kohesive.injekt.Injekt
import uy.kohesive.injekt.api.get
import eu.kanade.tachiyomi.network.NetworkHelper
import okhttp3.Request
import java.io.File
import java.util.Locale

/**
 * Manages LNReader JavaScript plugins:
 *  - Fetches the remote plugin index
 *  - Downloads / deletes individual plugin .js files to internal storage
 *  - Exposes StateFlows for the UI and parser to observe
 */
class LnReaderPluginManager(private val context: Context) {

    /** All plugins available in the remote index */
    private val _availablePlugins = MutableStateFlow<List<LnReaderPlugin>>(emptyList())
    val availablePlugins: StateFlow<List<LnReaderPlugin>> = _availablePlugins

    /** Plugins the user has installed (their .js has been downloaded) */
    private val _installedPlugins = MutableStateFlow<List<LnReaderPlugin>>(emptyList())
    val installedPlugins: StateFlow<List<LnReaderPlugin>> = _installedPlugins

    private val pluginDir: File
        get() = File(context.filesDir, "lnreader_plugins").also { it.mkdirs() }

    init {
        refreshInstalled()
    }

    // ── Remote Index ──────────────────────────────────────────────────────────

    /**
     * Fetches the plugin index from GitHub and updates [availablePlugins].
     * Call from a coroutine (IO dispatcher).
     */
    suspend fun fetchAvailablePlugins() = withContext(Dispatchers.IO) {
        val repos = PrefManager.getVal<Set<String>>(PrefName.NovelExtensionRepos)
        if (repos.isEmpty()) {
            _availablePlugins.value = emptyList()
            refreshInstalled()
            return@withContext
        }
        val plugins = mutableListOf<LnReaderPlugin>()
        val networkService: NetworkHelper = Injekt.get()
        for (repoUrl in repos) {
            try {
                val request = Request.Builder()
                    .url(repoUrl)
                    .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
                    .build()
                val response = networkService.client.newCall(request).execute()
                val json = response.body?.string() ?: continue
                val arr = JSONArray(json)
                for (i in 0 until arr.length()) {
                    val obj = arr.getJSONObject(i)
                    plugins.add(
                        LnReaderPlugin(
                            id = obj.getString("id"),
                            name = obj.getString("name"),
                            site = obj.optString("site", ""),
                            lang = obj.getString("lang"),
                            version = obj.getString("version"),
                            url = obj.getString("url"),
                            iconUrl = obj.optString("iconUrl", ""),
                            customCSS = obj.optString("customCSS").takeIf { it.isNotBlank() }
                        )
                    )
                }
            } catch (e: Exception) {
                Logger.log("LnReaderPluginManager: failed to fetch index from $repoUrl — ${e.message}")
            }
        }
        _availablePlugins.value = plugins
        refreshInstalled()
    }

    // ── Install / Uninstall ───────────────────────────────────────────────────

    /**
     * Downloads the plugin's .js file into internal storage.
     * @return true if download succeeded.
     */
    suspend fun installPlugin(plugin: LnReaderPlugin): Boolean = withContext(Dispatchers.IO) {
        try {
            val networkService: NetworkHelper = Injekt.get()
            val request = Request.Builder()
                .url(plugin.url)
                .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)")
                .build()
            val response = networkService.client.newCall(request).execute()
            if (!response.isSuccessful) {
                Logger.log("LnReaderPluginManager: HTTP ${response.code} downloading ${plugin.id}")
                return@withContext false
            }
            val jsContent = response.body?.string() ?: return@withContext false
            pluginFile(plugin.id).writeText(jsContent)
            if (_availablePlugins.value.none { it.id == plugin.id }) {
                _availablePlugins.value = _availablePlugins.value + plugin
            }
            refreshInstalled()
            true
        } catch (e: Exception) {
            Logger.log("LnReaderPluginManager: install failed for ${plugin.id} — ${e.message}")
            false
        }
    }

    /** Deletes the plugin's .js file from internal storage. */
    fun uninstallPlugin(plugin: LnReaderPlugin) {
        pluginFile(plugin.id).takeIf { it.exists() }?.delete()
        refreshInstalled()
    }

    /** Returns whether the plugin's .js file exists on disk. */
    fun isInstalled(plugin: LnReaderPlugin): Boolean = pluginFile(plugin.id).exists()

    /** Reads the JS content of an installed plugin. */
    fun readPluginJs(pluginId: String): String? {
        return pluginFile(pluginId).takeIf { it.exists() }?.readText()
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private fun pluginFile(pluginId: String) = File(pluginDir, "$pluginId.js")

    private fun refreshInstalled() {
        val installedIds = pluginDir.listFiles()
            ?.filter { it.extension == "js" }
            ?.map { it.nameWithoutExtension }
            ?.toSet()
            ?: emptySet()

        val knownPlugins = _availablePlugins.value.associateBy { it.id }
        _installedPlugins.value = installedIds.map { id ->
            knownPlugins[id] ?: LnReaderPlugin(
                id = id,
                name = id.replaceFirstChar { if (it.isLowerCase()) it.titlecase(Locale.ROOT) else it.toString() },
                site = "",
                lang = "all",
                version = "1.0.0",
                url = "",
                iconUrl = ""
            )
        }
    }
}
