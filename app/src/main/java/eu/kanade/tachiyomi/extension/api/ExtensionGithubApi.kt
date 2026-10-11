package eu.kanade.tachiyomi.extension.api

import ani.dantotsu.parsers.novel.AvailableNovelSources
import ani.dantotsu.parsers.novel.NovelExtension
import ani.dantotsu.settings.saving.PrefManager
import ani.dantotsu.settings.saving.PrefName
import ani.dantotsu.util.Logger
import eu.kanade.tachiyomi.extension.anime.model.AnimeExtension
import eu.kanade.tachiyomi.extension.anime.model.AvailableAnimeSources
import eu.kanade.tachiyomi.extension.manga.model.AvailableMangaSources
import eu.kanade.tachiyomi.extension.manga.model.MangaExtension
import eu.kanade.tachiyomi.extension.util.ExtensionLoader
import eu.kanade.tachiyomi.network.GET
import eu.kanade.tachiyomi.network.NetworkHelper
import eu.kanade.tachiyomi.network.awaitSuccess
import eu.kanade.tachiyomi.network.parseAs
import kotlinx.serialization.KSerializer
import kotlinx.serialization.Serializable
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.PrimitiveSerialDescriptor
import kotlinx.serialization.descriptors.SerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonDecoder
import kotlinx.serialization.json.JsonPrimitive
import org.json.JSONArray
import org.json.JSONObject
import tachiyomi.core.util.lang.withIOContext
import uy.kohesive.injekt.injectLazy

object AnyLongSerializer : KSerializer<Long> {
    override val descriptor: SerialDescriptor =
        PrimitiveSerialDescriptor("AnyLongSerializer", PrimitiveKind.LONG)

    override fun deserialize(decoder: Decoder): Long {
        return if (decoder is JsonDecoder) {
            val element = decoder.decodeJsonElement()
            if (element is JsonPrimitive) {
                element.content.toLongOrNull()
                    ?: element.content.toULongOrNull()?.toLong()
                    ?: 0L
            } else {
                0L
            }
        } else {
            try {
                decoder.decodeLong()
            } catch (e: Exception) {
                try {
                    decoder.decodeString().toLongOrNull() ?: 0L
                } catch (e2: Exception) {
                    0L
                }
            }
        }
    }

    override fun serialize(encoder: Encoder, value: Long) {
        encoder.encodeLong(value)
    }
}

internal class ExtensionGithubApi {
    private val networkService: NetworkHelper by injectLazy()
    private val json: Json by injectLazy()

    private fun List<ExtensionSourceJsonObject>.toAnimeExtensionSources(): List<AvailableAnimeSources> {
        return this.map {
            AvailableAnimeSources(
                id = it.id,
                lang = it.lang,
                name = it.name,
                baseUrl = it.baseUrl,
            )
        }
    }

    private fun List<ExtensionJsonObject>.toAnimeExtensions(repository: String): List<AnimeExtension.Available> {
        return this
            .filter {
                val libVersion = it.extractLibVersion()
                libVersion >= ExtensionLoader.ANIME_LIB_VERSION_MIN && libVersion <= ExtensionLoader.ANIME_LIB_VERSION_MAX
            }
            .map {
                AnimeExtension.Available(
                    name = it.name.substringAfter("Aniyomi: "),
                    pkgName = it.pkg,
                    versionName = it.version,
                    versionCode = it.code,
                    libVersion = it.extractLibVersion(),
                    lang = it.lang,
                    isNsfw = it.nsfw == 1,
                    hasReadme = it.hasReadme == 1,
                    hasChangelog = it.hasChangelog == 1,
                    sources = it.sources?.toAnimeExtensionSources().orEmpty(),
                    apkName = it.apk,
                    repository = repository,
                    iconUrl = "${repository.removeSuffix("/index.min.json")}/icon/${it.pkg}.png",
                )
            }
    }

    private fun shouldFilter(pkgName: String): Boolean {
        // TODO: Implement Regex filtering from preferences if needed
        // Example: return PrefManager.getVal<Set<String>>(PrefName.FilteredPackages).any { it.toRegex().matches(pkgName) }
        return false
    }

    suspend fun findAnimeExtensions(): List<AnimeExtension.Available> {
        return withIOContext {

            val extensions: ArrayList<AnimeExtension.Available> = arrayListOf()
            val seenPackages = mutableSetOf<String>()

            val configuredRepos =
                PrefManager.getVal<Set<String>>(PrefName.AnimeExtensionRepos).toMutableList()

            val repos = mutableListOf<String>()
            configuredRepos.forEach { repo ->
                if (repo.contains("aniyomiorg/aniyomi-extensions") || repo.contains("aniyomi-extensions")) {
                    repos.add("https://raw.githubusercontent.com/yuzono/anime-repo/repo/index.min.json")
                    repos.add(repo)
                } else {
                    repos.add(repo)
                }
            }
            if (repos.isEmpty()) {
                repos.add("https://raw.githubusercontent.com/yuzono/anime-repo/repo/index.min.json")
            }
            val distinctRepos = repos.distinct()

            if (configuredRepos.isEmpty() || configuredRepos.any { it.contains("aniyomi-extensions") }) {
                val updatedSet = configuredRepos.toMutableSet()
                updatedSet.add("https://raw.githubusercontent.com/yuzono/anime-repo/repo/index.min.json")
                PrefManager.setVal(PrefName.AnimeExtensionRepos, updatedSet)
            }

            android.util.Log.i("OtakuVerse", "findAnimeExtensions started with repos: $distinctRepos")
            distinctRepos.forEach {
                val repoUrl = if (it.contains("index.min.json")) {
                    it
                } else {
                    "$it${if (it.endsWith('/')) "" else "/"}index.min.json"
                }
                try {
                    val githubResponse = try {
                        networkService.client
                            .newCall(GET(repoUrl))
                            .awaitSuccess()
                    } catch (e: Throwable) {
                        android.util.Log.w("OtakuVerse", "Failed to get repo $repoUrl: ${e.message}")
                        val altUrl = when {
                            repoUrl.contains("/repo/index.min.json") -> repoUrl.replace("/repo/index.min.json", "/main/index.min.json")
                            repoUrl.contains("/main/index.min.json") -> repoUrl.replace("/main/index.min.json", "/repo/index.min.json")
                            else -> null
                        }
                        if (altUrl != null) {
                            try {
                                networkService.client.newCall(GET(altUrl)).awaitSuccess()
                            } catch (e2: Throwable) {
                                null
                            }
                        } else null
                    }

                    val response = githubResponse ?: run {
                        networkService.client
                            .newCall(GET(fallbackRepoUrl(it) + "/index.min.json"))
                            .awaitSuccess()
                    }

                    val bodyString = response.body.string()
                    android.util.Log.i("OtakuVerse", "Fetched $repoUrl, length=${bodyString.length}")
                    val repoExtensions = try {
                        val parsed = json.decodeFromString<List<ExtensionJsonObject>>(bodyString)
                            .toAnimeExtensions(it)
                        android.util.Log.i("OtakuVerse", "decodeFromString succeeded: ${parsed.size} anime extensions")
                        parsed
                    } catch (e: Throwable) {
                        android.util.Log.e("OtakuVerse", "json serializer failed, falling back to manual: ${e.message}")
                        val manual = parseAnimeExtensionsManually(bodyString, it)
                        android.util.Log.i("OtakuVerse", "manual parse got: ${manual.size} anime extensions")
                        manual
                    }

                    val uniqueExtensions = repoExtensions.filter { ext ->
                        val isNew = !seenPackages.contains(ext.pkgName)
                        val isNotFiltered = !shouldFilter(ext.pkgName)
                        if (isNew && isNotFiltered) {
                            seenPackages.add(ext.pkgName)
                            true
                        } else {
                            false
                        }
                    }

                    extensions.addAll(uniqueExtensions)
                    android.util.Log.i("OtakuVerse", "Total extensions so far: ${extensions.size}")
                } catch (e: Throwable) {
                    android.util.Log.e("OtakuVerse", "Failed to get extensions from GitHub: ${e.message}", e)
                    Logger.log(e)
                }
            }

            android.util.Log.i("OtakuVerse", "findAnimeExtensions returning ${extensions.size} extensions")
            extensions
        }
    }

    private fun parseAnimeExtensionsManually(jsonString: String, repository: String): List<AnimeExtension.Available> {
        val result = mutableListOf<AnimeExtension.Available>()
        try {
            val array = JSONArray(jsonString)
            for (i in 0 until array.length()) {
                val obj = array.optJSONObject(i) ?: continue
                val name = obj.optString("name", "")
                val pkg = obj.optString("pkg", "")
                val apk = obj.optString("apk", "")
                val lang = obj.optString("lang", "")
                val code = obj.optLong("code", 0L)
                val version = obj.optString("version", "")
                val nsfw = obj.optInt("nsfw", 0)
                val hasReadme = obj.optInt("hasReadme", 0)
                val hasChangelog = obj.optInt("hasChangelog", 0)

                val cleanLib = version.removePrefix("v").substringBeforeLast('.')
                val libVersion = cleanLib.toDoubleOrNull() ?: 0.0
                if (libVersion < ExtensionLoader.ANIME_LIB_VERSION_MIN || libVersion > ExtensionLoader.ANIME_LIB_VERSION_MAX) {
                    continue
                }

                val sourcesList = mutableListOf<AvailableAnimeSources>()
                val sourcesArray = obj.optJSONArray("sources")
                if (sourcesArray != null) {
                    for (j in 0 until sourcesArray.length()) {
                        val sObj = sourcesArray.optJSONObject(j) ?: continue
                        val idStr = sObj.optString("id", "")
                        val id = idStr.toLongOrNull() ?: idStr.toULongOrNull()?.toLong() ?: sObj.optLong("id", 0L)
                        sourcesList.add(
                            AvailableAnimeSources(
                                id = id,
                                lang = sObj.optString("lang", ""),
                                name = sObj.optString("name", ""),
                                baseUrl = sObj.optString("baseUrl", "")
                            )
                        )
                    }
                }

                val iconUrl = "${repository.removeSuffix("/index.min.json")}/icon/$pkg.png"
                result.add(
                    AnimeExtension.Available(
                        name = name.substringAfter("Aniyomi: "),
                        pkgName = pkg,
                        versionName = version,
                        versionCode = code,
                        libVersion = libVersion,
                        lang = lang,
                        isNsfw = nsfw == 1,
                        hasReadme = hasReadme == 1,
                        hasChangelog = hasChangelog == 1,
                        sources = sourcesList,
                        apkName = apk,
                        repository = repository,
                        iconUrl = iconUrl
                    )
                )
            }
        } catch (e: Exception) {
            Logger.log("Manual anime extension parse failed: ${e.message}")
        }
        return result
    }

    fun getAnimeApkUrl(extension: AnimeExtension.Available): String {
        val base = extension.repository.removeSuffix("/").removeSuffix("index.min.json").removeSuffix("/")
        return "$base/apk/${extension.apkName}"
    }

    private fun List<ExtensionSourceJsonObject>.toMangaExtensionSources(): List<AvailableMangaSources> {
        return this.map {
            AvailableMangaSources(
                id = it.id,
                lang = it.lang,
                name = it.name,
                baseUrl = it.baseUrl,
            )
        }
    }

    private fun List<ExtensionJsonObject>.toMangaExtensions(repository: String): List<MangaExtension.Available> {
        return this
            .filter {
                val libVersion = it.extractLibVersion()
                libVersion >= ExtensionLoader.MANGA_LIB_VERSION_MIN && libVersion <= ExtensionLoader.MANGA_LIB_VERSION_MAX
            }
            .map {
                MangaExtension.Available(
                    name = it.name.substringAfter("Tachiyomi: "),
                    pkgName = it.pkg,
                    versionName = it.version,
                    versionCode = it.code,
                    libVersion = it.extractLibVersion(),
                    lang = it.lang,
                    isNsfw = it.nsfw == 1,
                    hasReadme = it.hasReadme == 1,
                    hasChangelog = it.hasChangelog == 1,
                    sources = it.sources?.toMangaExtensionSources().orEmpty(),
                    apkName = it.apk,
                    repository = repository,
                    iconUrl = "${repository.removeSuffix("/index.min.json")}/icon/${it.pkg}.png",
                )
            }
    }

    suspend fun findMangaExtensions(): List<MangaExtension.Available> {
        return withIOContext {

            val extensions: ArrayList<MangaExtension.Available> = arrayListOf()
            val seenPackages = mutableSetOf<String>()

            val configuredRepos =
                PrefManager.getVal<Set<String>>(PrefName.MangaExtensionRepos).toMutableList()
            if (configuredRepos.isEmpty()) {
                configuredRepos.add("https://raw.githubusercontent.com/keiyoushi/extensions/repo/index.json")
            }

            configuredRepos.forEach {
                val repoUrl = if (it.contains("keiyoushi/extensions")) {
                    if (it.endsWith("index.min.json")) {
                        it.replace("index.min.json", "index.json")
                    } else if (!it.endsWith("index.json")) {
                        "$it${if (it.endsWith('/')) "" else "/"}index.json"
                    } else {
                        it
                    }
                } else if (it.contains("index.min.json") || it.contains("index.json")) {
                    it
                } else {
                    "$it${if (it.endsWith('/')) "" else "/"}index.min.json"
                }
                try {
                    val githubResponse = try {
                        networkService.client
                            .newCall(GET(repoUrl))
                            .awaitSuccess()
                    } catch (e: Throwable) {
                        Logger.log("Failed to get repo: $repoUrl")
                        val altUrl = when {
                            repoUrl.contains("/repo/index.min.json") -> repoUrl.replace("/repo/index.min.json", "/main/index.min.json")
                            repoUrl.contains("/main/index.min.json") -> repoUrl.replace("/main/index.min.json", "/repo/index.min.json")
                            else -> null
                        }
                        if (altUrl != null) {
                            try {
                                networkService.client.newCall(GET(altUrl)).awaitSuccess()
                            } catch (e2: Throwable) {
                                null
                            }
                        } else null
                    }

                    val response = githubResponse ?: run {
                        val fallback = fallbackRepoUrl(it)
                        if (fallback != null) {
                            networkService.client
                                .newCall(GET(fallback + "/index.min.json"))
                                .awaitSuccess()
                        } else null
                    }

                    if (response != null) {
                        val bodyString = response.body.string()
                        val repoExtensions = if (bodyString.trimStart().startsWith("{")) {
                            parseMangaExtensionsManually(bodyString, it)
                        } else {
                            try {
                                json.decodeFromString<List<ExtensionJsonObject>>(bodyString)
                                    .toMangaExtensions(it)
                            } catch (e: Throwable) {
                                Logger.log("Failed to parse manga extensions with json serializer, falling back to manual: ${e.message}")
                                parseMangaExtensionsManually(bodyString, it)
                            }
                        }

                        val uniqueExtensions = repoExtensions.filter { ext ->
                            val isNew = ext.pkgName.isNotBlank() && !seenPackages.contains(ext.pkgName)
                            val isNotFiltered = !shouldFilter(ext.pkgName)
                            if (isNew && isNotFiltered) {
                                seenPackages.add(ext.pkgName)
                                true
                            } else {
                                false
                            }
                        }

                        extensions.addAll(uniqueExtensions)
                    }
                } catch (e: Throwable) {
                    Logger.log("Failed to get extensions from GitHub")
                    Logger.log(e)
                }
            }

            extensions
        }
    }

    private fun parseMangaExtensionsManually(jsonString: String, repository: String): List<MangaExtension.Available> {
        val result = mutableListOf<MangaExtension.Available>()
        try {
            val array = if (jsonString.trimStart().startsWith("{")) {
                val rootObj = JSONObject(jsonString)
                rootObj.optJSONObject("extensionList")?.optJSONArray("extensions")
                    ?: rootObj.optJSONArray("extensions")
                    ?: JSONArray()
            } else {
                JSONArray(jsonString)
            }

            for (i in 0 until array.length()) {
                val obj = array.optJSONObject(i) ?: continue
                val name = obj.optString("name", "")
                val pkg = obj.optString("packageName", obj.optString("pkg", ""))
                val resources = obj.optJSONObject("resources")
                val apk = resources?.optString("apkUrl", "") ?: obj.optString("apk", "")
                val version = obj.optString("versionName", obj.optString("version", ""))
                val code = obj.optString("versionCode", "0").toLongOrNull()
                    ?: obj.optLong("versionCode", obj.optLong("code", 0L))

                val explicitLib = obj.optString("extensionLib", "")
                val libVersion = if (explicitLib.isNotBlank()) {
                    explicitLib.removePrefix("v").toDoubleOrNull() ?: 0.0
                } else {
                    val cleanLib = version.removePrefix("v").substringBeforeLast('.')
                    cleanLib.toDoubleOrNull() ?: version.removePrefix("v").toDoubleOrNull() ?: 0.0
                }
                if (libVersion < ExtensionLoader.MANGA_LIB_VERSION_MIN || libVersion > ExtensionLoader.MANGA_LIB_VERSION_MAX) {
                    continue
                }

                val nsfw = if (obj.optString("contentWarning") == "CONTENT_WARNING_NSFW" || obj.optInt("nsfw", 0) == 1) 1 else 0
                val hasReadme = obj.optInt("hasReadme", 0)
                val hasChangelog = obj.optInt("hasChangelog", 0)

                val sourcesList = mutableListOf<AvailableMangaSources>()
                val sourcesArray = obj.optJSONArray("sources")
                if (sourcesArray != null) {
                    for (j in 0 until sourcesArray.length()) {
                        val sObj = sourcesArray.optJSONObject(j) ?: continue
                        val idStr = sObj.optString("id", "")
                        val id = idStr.toLongOrNull() ?: idStr.toULongOrNull()?.toLong() ?: sObj.optLong("id", 0L)
                        sourcesList.add(
                            AvailableMangaSources(
                                id = id,
                                lang = sObj.optString("language", sObj.optString("lang", "")),
                                name = sObj.optString("name", ""),
                                baseUrl = sObj.optString("homeUrl", sObj.optString("baseUrl", ""))
                            )
                        )
                    }
                }

                val lang = obj.optString("lang", if (sourcesList.isNotEmpty()) sourcesList[0].lang else "all")
                val iconUrl = resources?.optString("iconUrl", "")
                    ?: "${repository.removeSuffix("/").removeSuffix("index.json").removeSuffix("index.min.json")}/icon/$pkg.png"

                result.add(
                    MangaExtension.Available(
                        name = name.substringAfter("Tachiyomi: "),
                        pkgName = pkg,
                        versionName = version,
                        versionCode = code,
                        libVersion = libVersion,
                        lang = lang,
                        isNsfw = nsfw == 1,
                        hasReadme = hasReadme == 1,
                        hasChangelog = hasChangelog == 1,
                        sources = sourcesList,
                        apkName = apk,
                        repository = repository,
                        iconUrl = iconUrl
                    )
                )
            }
        } catch (e: Exception) {
            Logger.log("Manual manga extension parse failed: ${e.message}")
        }
        return result
    }

    fun getMangaApkUrl(extension: MangaExtension.Available): String {
        if (extension.apkName.startsWith("http://") || extension.apkName.startsWith("https://")) {
            return extension.apkName
        }
        val base = extension.repository.removeSuffix("/").removeSuffix("index.min.json").removeSuffix("index.json").removeSuffix("/")
        return "$base/apk/${extension.apkName}"
    }

    suspend fun findNovelExtensions(): List<NovelExtension.Available> {
        return withIOContext {

            val extensions: ArrayList<NovelExtension.Available> = arrayListOf()
            val seenPackages = mutableSetOf<String>()

            val repos =
                PrefManager.getVal<Set<String>>(PrefName.NovelExtensionRepos).toMutableList()
            if (repos.isEmpty()) {
                repos.add("https://raw.githubusercontent.com/LNReader/lnreader-plugins/plugins/v3.0.0/.dist/plugins.min.json")
            }

            repos.forEach {
                val repoUrl = if (it.contains("index.min.json") || it.contains("plugins.min.json")) {
                    it
                } else {
                    "$it${if (it.endsWith('/')) "" else "/"}index.min.json"
                }
                try {
                    val githubResponse = try {
                        networkService.client
                            .newCall(GET(repoUrl))
                            .awaitSuccess()
                    } catch (e: Throwable) {
                        Logger.log("Failed to get repo: $repoUrl")
                        val fallback = fallbackRepoUrl(it)
                        if (fallback != null) {
                            val url = if (it.contains("plugins.min.json")) {
                                "$fallback/plugins.min.json"
                            } else {
                                "$fallback/index.min.json"
                            }
                            try {
                                networkService.client.newCall(GET(url)).awaitSuccess()
                            } catch (e2: Throwable) {
                                null
                            }
                        } else null
                    }

                    val response = githubResponse
                    if (response != null) {
                        val responseBody = response.body.string()
                        if (it.contains("plugins.min.json") || responseBody.contains("\"site\":") || responseBody.contains("\"url\":")) {
                            try {
                                val arr = JSONArray(responseBody)
                                for (i in 0 until arr.length()) {
                                    val obj = arr.getJSONObject(i)
                                    val pluginId = obj.getString("id")
                                    val pkgName = "lnreader.plugin.$pluginId"

                                    if (!seenPackages.contains(pkgName)) {
                                        seenPackages.add(pkgName)
                                        val iconUrl = obj.optString("iconUrl", "")
                                        val urlForPlugin = obj.getString("url")
                                        val fallbackIcon = if (iconUrl.isNotBlank()) iconUrl else "https://raw.githubusercontent.com/LNReader/lnreader-plugins/plugins/v3.0.0/.dist/icon/default.png"

                                        extensions.add(
                                            NovelExtension.Available(
                                                name = obj.getString("name"),
                                                pkgName = pkgName,
                                                versionName = obj.getString("version"),
                                                versionCode = 1,
                                                repository = it,
                                                sources = emptyList(),
                                                iconUrl = fallbackIcon,
                                                apkName = urlForPlugin
                                            )
                                        )
                                    }
                                }
                            } catch (e2: Exception) {
                                Logger.log("Failed to parse LNReader repo: ${e2.message}")
                            }
                        } else {
                            try {
                                val repoExtensions = json.decodeFromString<List<ExtensionJsonObject>>(responseBody).toNovelExtensions(it)
                                val uniqueExtensions = repoExtensions.filter { ext ->
                                    val isNew = ext.pkgName.isNotBlank() && !seenPackages.contains(ext.pkgName)
                                    val isNotFiltered = !shouldFilter(ext.pkgName)
                                    if (isNew && isNotFiltered) {
                                        seenPackages.add(ext.pkgName)
                                        true
                                    } else {
                                        false
                                    }
                                }
                                extensions.addAll(uniqueExtensions)
                            } catch (e: Exception) {
                                Logger.log("Standard novel parse failed: ${e.message}")
                            }
                        }
                    }
                } catch (e: Throwable) {
                    Logger.log("Failed to get extensions from GitHub: ${e.message}")
                    Logger.log(e)
                }
            }

            extensions
        }
    }

    private fun List<ExtensionJsonObject>.toNovelExtensions(repository: String): List<NovelExtension.Available> {
        return mapNotNull { extension ->
            val sources = extension.sources?.map { source ->
                ExtensionSourceJsonObject(
                    source.id,
                    source.lang,
                    source.name,
                    source.baseUrl,
                )
            }
            val iconUrl = "${repository.removeSuffix("/index.min.json")}/icon/${extension.pkg}.png"
            NovelExtension.Available(
                extension.name,
                extension.pkg,
                extension.apk,
                extension.code,
                repository,
                sources?.toNovelSources() ?: emptyList(),
                iconUrl,
            )
        }
    }

    private fun List<ExtensionSourceJsonObject>.toNovelSources(): List<AvailableNovelSources> {
        return map { source ->
            AvailableNovelSources(
                source.id,
                source.lang,
                source.name,
                source.baseUrl,
            )
        }
    }

    fun getNovelApkUrl(extension: NovelExtension.Available): String {
        return "${extension.repository.removeSuffix("index.min.json")}/apk/${extension.pkgName}.apk"
    }

    private fun fallbackRepoUrl(repoUrl: String): String? {
        var fallbackRepoUrl = "https://gcore.jsdelivr.net/gh/"
        val strippedRepoUrl = repoUrl
            .removePrefix("https://")
            .removePrefix("http://")
            .removeSuffix("/")
            .removeSuffix("/index.min.json")
            .removeSuffix("/plugins.min.json")
        val repoUrlParts = strippedRepoUrl.split("/")
        if (repoUrlParts.size < 3) {
            return null
        }
        val repoOwner = repoUrlParts[1]
        val repoName = repoUrlParts[2]
        fallbackRepoUrl += "$repoOwner/$repoName"
        val repoBranch = if (repoUrlParts.size > 3) {
            repoUrlParts[3]
        } else {
            "main"
        }
        fallbackRepoUrl += "@$repoBranch"
        return fallbackRepoUrl
    }
}

@Serializable
private data class ExtensionJsonObject(
    val name: String = "",
    val pkg: String = "",
    val apk: String = "",
    val lang: String = "",
    @Serializable(with = AnyLongSerializer::class)
    val code: Long = 0L,
    val version: String = "",
    val nsfw: Int = 0,
    val hasReadme: Int = 0,
    val hasChangelog: Int = 0,
    val sources: List<ExtensionSourceJsonObject>? = null,
)

@Serializable
private data class ExtensionSourceJsonObject(
    @Serializable(with = AnyLongSerializer::class)
    val id: Long = 0L,
    val lang: String = "",
    val name: String = "",
    val baseUrl: String = "",
)

private fun ExtensionJsonObject.extractLibVersion(): Double {
    val clean = version.removePrefix("v").substringBeforeLast('.')
    return clean.toDoubleOrNull() ?: version.removePrefix("v").toDoubleOrNull() ?: 0.0
}
