import java.io.File
import org.apache.tools.ant.taskdefs.condition.Os
import org.gradle.api.DefaultTask
import org.gradle.api.GradleException
import org.gradle.api.logging.LogLevel
import org.gradle.api.tasks.Input
import org.gradle.api.tasks.TaskAction

open class BuildTask : DefaultTask() {
    @Input
    var rootDirRel: String? = null
    @Input
    var target: String? = null
    @Input
    var release: Boolean? = null

    @TaskAction
    fun assemble() {
        val rootDirRel = rootDirRel ?: throw GradleException("rootDirRel cannot be null")
        val target = target ?: throw GradleException("target cannot be null")
        val release = release ?: throw GradleException("release cannot be null")

        val workingDir = File(project.projectDir, rootDirRel)

        val baseArgs = mutableListOf("android", "android-studio-script")
        if (project.logger.isEnabled(LogLevel.DEBUG)) {
            baseArgs.add("-vv")
        } else if (project.logger.isEnabled(LogLevel.INFO)) {
            baseArgs.add("-v")
        }
        if (release) {
            baseArgs.add("--release")
        }
        baseArgs.addAll(listOf("--target", target))

        // Fully-typed candidates checking global CLI, package managers, and Cargo
        val candidates: List<Pair<String, List<String>>> = listOf(
            Pair("tauri", emptyList()),
            Pair("npx", listOf("--no-install", "tauri")),
            Pair("npm", listOf("run", "--", "tauri")),
            Pair("pnpm", listOf("tauri")),
            Pair("yarn", listOf("tauri")),
            Pair("bun", listOf("tauri")),
            Pair("cargo", listOf("tauri"))
        )

        for ((bin, prefixArgs) in candidates) {
            val fullArgs = prefixArgs + baseArgs
            if (execCommand(workingDir, bin, fullArgs)) {
                return
            }
        }

        throw GradleException("Failed to run Tauri CLI. Ensure 'tauri' or your package manager is installed and in PATH.")
    }

    private fun execCommand(workingDir: File, executable: String, args: List<String>): Boolean {
        val extensions = if (Os.isFamily(Os.FAMILY_WINDOWS)) listOf("", ".cmd", ".exe") else listOf("")
        for (ext in extensions) {
            val targetBin = if (executable.endsWith(".cmd") || executable.endsWith(".exe")) executable else "$executable$ext"
            try {
                project.exec {
                    workingDir(workingDir)
                    executable(targetBin)
                    args(args)
                }.assertNormalExitValue()
                return true
            } catch (ignored: Exception) {}
        }
        return false
    }
}