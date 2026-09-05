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
        val rootDir = File(project.projectDir, rootDirRel)
        val isWindows = Os.isFamily(Os.FAMILY_WINDOWS)

        // If `tauri` was installed as a *local* project dependency, npm, yarn,
        // pnpm and bun all behave identically: they create a shim inside
        // `node_modules/.bin`. It is never placed on PATH, so it must be
        // located relative to the project instead.
        val localBin = File(
            rootDir,
            if (isWindows) "node_modules/.bin/tauri.cmd" else "node_modules/.bin/tauri"
        )

        if (localBin.exists()) {
            runTauriCli(localBin.absolutePath, rootDir)
            return
        }

        // Otherwise assume the user made `tauri` available on PATH themselves
        // (cargo install, a *global* npm/yarn/pnpm/bun install, or a manual
        // install). We deliberately do NOT search any hardcoded/well-known
        // install directories such as `~/.cargo/bin` — that is the user's
        // responsibility.
        val candidates = if (isWindows) {
            // Windows resolves a bare "tauri" to "tauri.exe" automatically,
            // but never to "tauri.cmd" - which is what global JS package
            // managers create - so retry explicitly with that extension.
            listOf("tauri", "tauri.cmd", "cargo-tauri", "cargo-tauri.cmd")
        } else {
            listOf("tauri", "cargo-tauri")
        }
        for ((index, cmd) in candidates.withIndex()) {
            try {
                runTauriCli(cmd, rootDir)
                return
            } catch (e: Exception) {
                if (index == candidates.lastIndex) {
                    throw e
                }
            }
        }
    }

    private fun runTauriCli(executable: String, rootDir: File) {
        val target = target ?: throw GradleException("target cannot be null")
        val release = release ?: throw GradleException("release cannot be null")

        val args = mutableListOf("android", "android-studio-script")
        if (project.logger.isEnabled(LogLevel.DEBUG)) {
            args.add("-vv")
        } else if (project.logger.isEnabled(LogLevel.INFO)) {
            args.add("-v")
        }
        if (release) {
            args.add("--release")
        }
        args.add("--target")
        args.add(target)

        project.exec {
            workingDir(rootDir)
            executable(executable)
            args(args)
        }.assertNormalExitValue()
    }
}