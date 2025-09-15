"""A polished Flappy Bird inspired arcade game built with pygame.

This module provides a fully featured take on the classic Flappy Bird
formula. It features lovingly crafted vector style graphics, parallax
backgrounds, smooth animations and an adaptive difficulty curve. Run
this file directly with Python to play the game.
"""

from __future__ import annotations

import math
import random
from dataclasses import dataclass
from pathlib import Path
from typing import List, Tuple

import pygame

# Window configuration
WIDTH, HEIGHT = 540, 900
FPS = 60
GROUND_HEIGHT = 140

# Physics configuration
GRAVITY = 2300.0
FLAP_STRENGTH = 750.0
MAX_DROP_SPEED = 1200.0

# Pipe configuration
PIPE_SPEED = 220.0
PIPE_GAP_BASE = 240
PIPE_GAP_MIN = 150
PIPE_SPAWN_INTERVAL = 1.9

# High score persistence
HIGHSCORE_FILE = Path(__file__).with_name("highscore.txt")


@dataclass
class PipePair:
    """Represents the top and bottom pipes that form a single obstacle."""

    x: float
    gap_y: float
    gap_size: float
    passed: bool = False

    WIDTH: int = 96
    COLOR_LIGHT: Tuple[int, int, int] = (90, 200, 90)
    COLOR_DARK: Tuple[int, int, int] = (60, 150, 60)

    @property
    def top_rect(self) -> pygame.Rect:
        height = self.gap_y - self.gap_size / 2
        return pygame.Rect(int(self.x), 0, self.WIDTH, int(height))

    @property
    def bottom_rect(self) -> pygame.Rect:
        top = self.gap_y + self.gap_size / 2
        height = HEIGHT - GROUND_HEIGHT - top
        return pygame.Rect(int(self.x), int(top), self.WIDTH, int(height))

    def update(self, dt: float) -> None:
        self.x -= PIPE_SPEED * dt

    def is_off_screen(self) -> bool:
        return self.x + self.WIDTH < -10

    def draw(self, surface: pygame.Surface) -> None:
        self._draw_pipe(surface, self.top_rect, upside_down=True)
        self._draw_pipe(surface, self.bottom_rect, upside_down=False)

    def _draw_pipe(self, surface: pygame.Surface, rect: pygame.Rect, *, upside_down: bool) -> None:
        pipe_surface = pygame.Surface(rect.size, pygame.SRCALPHA)
        body_color = self.COLOR_LIGHT
        shade_color = self.COLOR_DARK
        pygame.draw.rect(pipe_surface, body_color, (0, 0, rect.width, rect.height))
        pygame.draw.rect(pipe_surface, shade_color, (0, 0, rect.width, 18))
        pygame.draw.rect(pipe_surface, shade_color, (0, rect.height - 18, rect.width, 18))
        pygame.draw.rect(pipe_surface, shade_color, (10, 0, 16, rect.height))
        if upside_down:
            pipe_surface = pygame.transform.flip(pipe_surface, False, True)
        surface.blit(pipe_surface, rect.topleft)


class Bird:
    """Player controlled bird with expressive animation and rotation."""

    def __init__(self) -> None:
        self.x = WIDTH * 0.35
        self.y = HEIGHT / 2
        self.velocity = 0.0
        self.rotation = 0.0
        self.time_since_flap = 0.0
        self.anim_phase = 0.0
        self.idle_offset = 0.0

    def reset(self) -> None:
        self.__init__()

    @property
    def rect(self) -> pygame.Rect:
        return pygame.Rect(int(self.x - 36), int(self.y - 28), 72, 56)

    def flap(self) -> None:
        self.velocity = -FLAP_STRENGTH
        self.time_since_flap = 0.0

    def update(self, dt: float, *, game_state: str) -> None:
        self.time_since_flap += dt
        self.anim_phase += dt * (6 if game_state == "playing" else 3)

        if game_state == "playing":
            self.velocity = min(self.velocity + GRAVITY * dt, MAX_DROP_SPEED)
            self.y += self.velocity * dt
        else:
            idle_amplitude = 20
            idle_speed = 2.2
            self.idle_offset += dt * idle_speed
            self.y = HEIGHT / 2 + math.sin(self.idle_offset) * idle_amplitude

        target_rot = max(-28, min(75, -self.velocity * 0.05))
        self.rotation += (target_rot - self.rotation) * min(1, dt * 10)

    def draw(self, surface: pygame.Surface) -> None:
        bird_surface = pygame.Surface((96, 80), pygame.SRCALPHA)
        wing_offset = math.sin(self.anim_phase * 2) * 16
        self._draw_body(bird_surface, wing_offset)
        rotated = pygame.transform.smoothscale(pygame.transform.rotozoom(bird_surface, self.rotation, 0.9), (96, 80))
        surface.blit(rotated, rotated.get_rect(center=(self.x, self.y)))

    def _draw_body(self, surface: pygame.Surface, wing_offset: float) -> None:
        body_color = (240, 212, 80)
        belly_color = (255, 240, 150)
        outline = (90, 60, 20)
        wing_color = (250, 160, 60)
        eye_white = (255, 255, 255)
        eye_dark = (40, 40, 40)
        beak_color = (255, 120, 40)

        pygame.draw.ellipse(surface, body_color, (18, 20, 60, 42))
        pygame.draw.ellipse(surface, belly_color, (32, 32, 36, 24))
        pygame.draw.arc(surface, outline, (18, 20, 60, 42), math.pi * 0.2, math.pi * 0.8, 3)
        pygame.draw.arc(surface, outline, (25, 28, 50, 34), math.pi * 0.2, math.pi * 0.8, 3)

        wing_surface = pygame.Surface((44, 36), pygame.SRCALPHA)
        pygame.draw.ellipse(wing_surface, wing_color, (0, 6, 44, 24))
        pygame.draw.ellipse(wing_surface, outline, (0, 6, 44, 24), 3)
        wing_rect = wing_surface.get_rect(center=(32, 44 + wing_offset))
        surface.blit(wing_surface, wing_rect)

        pygame.draw.polygon(surface, beak_color, [(70, 46), (92, 40), (92, 52)])
        pygame.draw.circle(surface, eye_white, (54, 38), 10)
        pygame.draw.circle(surface, eye_dark, (58, 38), 4)

    def get_collision_rects(self) -> List[pygame.Rect]:
        r = self.rect
        hitbox = pygame.Rect(r.x + 12, r.y + 6, r.width - 24, r.height - 12)
        head = pygame.Rect(r.centerx - 12, r.y + 4, 24, 24)
        return [hitbox, head]


class TiledLayer:
    """Simple infinitely scrolling background layer."""

    def __init__(self, tile_surface: pygame.Surface, speed: float, y: int) -> None:
        self.surface = tile_surface
        self.speed = speed
        self.y = y
        self.offset = 0.0

    def update(self, dt: float) -> None:
        self.offset = (self.offset + self.speed * dt) % self.surface.get_width()

    def draw(self, target: pygame.Surface) -> None:
        x = -self.offset
        while x < WIDTH:
            target.blit(self.surface, (x, self.y))
            x += self.surface.get_width()


class ParallaxScene:
    """Composes the layered background with animated sky colours."""

    def __init__(self) -> None:
        self.time = 0.0
        self.sky_surface = pygame.Surface((WIDTH, HEIGHT))
        self.sun_surface = self._create_sun_surface(240)
        self.sun_path_radius = HEIGHT * 0.4
        self.mountains = TiledLayer(self._create_mountain_tile(), speed=18, y=int(HEIGHT * 0.55))
        self.hills = TiledLayer(self._create_hill_tile(), speed=42, y=int(HEIGHT * 0.65))
        self.clouds = TiledLayer(self._create_cloud_tile(), speed=65, y=int(HEIGHT * 0.18))
        self.foreground = TiledLayer(self._create_foreground_tile(), speed=PIPE_SPEED, y=HEIGHT - GROUND_HEIGHT)

    def update(self, dt: float) -> None:
        self.time += dt
        self.mountains.update(dt)
        self.hills.update(dt)
        self.clouds.update(dt)
        self.foreground.update(dt)

    def draw(self, surface: pygame.Surface) -> None:
        top_color, bottom_color = self._current_sky_colors()
        self._fill_gradient(self.sky_surface, top_color, bottom_color)
        surface.blit(self.sky_surface, (0, 0))

        sun_center = self._sun_position()
        surface.blit(self.sun_surface, self.sun_surface.get_rect(center=sun_center))

        self.clouds.draw(surface)
        self.mountains.draw(surface)
        self.hills.draw(surface)
        self.foreground.draw(surface)

    def _current_sky_colors(self) -> Tuple[Tuple[int, int, int], Tuple[int, int, int]]:
        cycle = 42.0
        t = (self.time % cycle) / cycle
        dawn = ((80, 110, 200), (200, 170, 220))
        noon = ((70, 180, 255), (180, 230, 255))
        dusk = ((25, 20, 60), (90, 45, 80))
        phases = [dawn, noon, dawn, dusk]
        idx = int(t * (len(phases)))
        next_idx = (idx + 1) % len(phases)
        blend = (t * len(phases)) % 1
        top = self._lerp_color(phases[idx][0], phases[next_idx][0], blend)
        bottom = self._lerp_color(phases[idx][1], phases[next_idx][1], blend)
        return top, bottom

    def _sun_position(self) -> Tuple[int, int]:
        cycle = 24.0
        t = (self.time % cycle) / cycle
        angle = math.pi * 1.2 + t * math.pi * 1.6
        cx = WIDTH * 0.8
        cy = HEIGHT * 0.3
        return int(cx + math.cos(angle) * self.sun_path_radius), int(cy + math.sin(angle) * self.sun_path_radius)

    @staticmethod
    def _fill_gradient(surface: pygame.Surface, top_color: Tuple[int, int, int], bottom_color: Tuple[int, int, int]) -> None:
        height = surface.get_height()
        for y in range(height):
            blend = y / max(1, height - 1)
            color = ParallaxScene._lerp_color(top_color, bottom_color, blend)
            pygame.draw.line(surface, color, (0, y), (surface.get_width(), y))

    @staticmethod
    def _lerp_color(a: Tuple[int, int, int], b: Tuple[int, int, int], t: float) -> Tuple[int, int, int]:
        return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))

    @staticmethod
    def _create_sun_surface(radius: int) -> pygame.Surface:
        surface = pygame.Surface((radius * 2, radius * 2), pygame.SRCALPHA)
        for r in range(radius, 0, -1):
            alpha = int(255 * (1 - r / radius))
            color = (255, 220, 140, alpha)
            pygame.draw.circle(surface, color, (radius, radius), r)
        return surface

    @staticmethod
    def _create_cloud_tile() -> pygame.Surface:
        tile = pygame.Surface((480, 140), pygame.SRCALPHA)
        for i in range(4):
            cloud = pygame.Surface((200, 110), pygame.SRCALPHA)
            for _ in range(6):
                x = random.randint(10, 160)
                y = random.randint(10, 80)
                w = random.randint(60, 120)
                h = random.randint(40, 90)
                pygame.draw.ellipse(cloud, (255, 255, 255, 170), (x, y, w, h))
            cloud = pygame.transform.smoothscale(cloud, (200, 110))
            tile.blit(cloud, (i * 120 - 50, random.randint(0, 20)))
        return tile

    @staticmethod
    def _create_mountain_tile() -> pygame.Surface:
        tile = pygame.Surface((WIDTH, 240), pygame.SRCALPHA)
        base_y = tile.get_height()
        points = [(0, base_y)]
        for x in range(0, WIDTH + 120, 120):
            height = random.randint(60, 140)
            points.append((x, base_y - height))
        points.append((WIDTH, base_y))
        pygame.draw.polygon(tile, (70, 90, 150), points)
        pygame.draw.polygon(tile, (55, 70, 120), [(x, y + 20) for x, y in points])
        return tile

    @staticmethod
    def _create_hill_tile() -> pygame.Surface:
        tile = pygame.Surface((WIDTH, 200), pygame.SRCALPHA)
        base_y = tile.get_height()
        color = (90, 180, 90)
        shade = (60, 140, 60)
        pygame.draw.ellipse(tile, color, (-160, base_y - 160, WIDTH, 240))
        pygame.draw.ellipse(tile, shade, (120, base_y - 140, WIDTH, 220))
        return tile

    @staticmethod
    def _create_foreground_tile() -> pygame.Surface:
        tile = pygame.Surface((WIDTH, GROUND_HEIGHT), pygame.SRCALPHA)
        tile.fill((220, 200, 120))
        for x in range(0, WIDTH, 24):
            pygame.draw.rect(tile, (200, 180, 100), (x, 0, 14, GROUND_HEIGHT))
        pygame.draw.rect(tile, (145, 90, 60), (0, GROUND_HEIGHT - 36, WIDTH, 36))
        for x in range(0, WIDTH, 38):
            pygame.draw.rect(tile, (110, 70, 40), (x, GROUND_HEIGHT - 40, 20, 12))
        return tile


class ScoreDisplay:
    """Handles beautifully rendered score and messages."""

    def __init__(self) -> None:
        pygame.font.init()
        self.big_font = pygame.font.Font(None, 96)
        self.medium_font = pygame.font.Font(None, 54)
        self.small_font = pygame.font.Font(None, 36)

    def draw_score(self, surface: pygame.Surface, score: int) -> None:
        text = self.big_font.render(str(score), True, (255, 255, 255))
        shadow = self.big_font.render(str(score), True, (0, 0, 0))
        rect = text.get_rect(center=(WIDTH // 2, HEIGHT * 0.12))
        surface.blit(shadow, rect.move(4, 4))
        surface.blit(text, rect)

    def draw_message(self, surface: pygame.Surface, headline: str, subtext: str) -> None:
        headline_surf = self.medium_font.render(headline, True, (255, 255, 255))
        shadow = self.medium_font.render(headline, True, (0, 0, 0))
        rect = headline_surf.get_rect(center=(WIDTH // 2, HEIGHT * 0.38))
        surface.blit(shadow, rect.move(3, 3))
        surface.blit(headline_surf, rect)

        sub_surf = self.small_font.render(subtext, True, (230, 230, 230))
        sub_rect = sub_surf.get_rect(center=(WIDTH // 2, HEIGHT * 0.45))
        surface.blit(sub_surf, sub_rect)

    def draw_highscore(self, surface: pygame.Surface, best: int) -> None:
        text = self.small_font.render(f"High score: {best}", True, (255, 255, 255))
        surface.blit(text, (16, 16))


class Game:
    def __init__(self) -> None:
        pygame.init()
        pygame.display.set_caption("Dreamy Flappy Bird")
        self.screen = pygame.display.set_mode((WIDTH, HEIGHT))
        self.clock = pygame.time.Clock()
        self.scene = ParallaxScene()
        self.score_display = ScoreDisplay()
        self.bird = Bird()
        self.pipes: List[PipePair] = []
        self.spawn_timer = 0.0
        self.score = 0
        self.best_score = self._load_highscore()
        self.state = "ready"
        self.flash_time = 0.0

    def reset(self) -> None:
        self.bird.reset()
        self.pipes.clear()
        self.spawn_timer = 0.0
        self.score = 0
        self.state = "ready"
        self.flash_time = 0.0

    def run(self) -> None:
        running = True
        while running:
            dt = self.clock.tick(FPS) / 1000.0
            for event in pygame.event.get():
                if event.type == pygame.QUIT:
                    running = False
                elif event.type == pygame.KEYDOWN and event.key in (pygame.K_ESCAPE, pygame.K_q):
                    running = False
                elif event.type in (pygame.KEYDOWN, pygame.MOUSEBUTTONDOWN):
                    if event.type == pygame.KEYDOWN and event.key not in (pygame.K_SPACE, pygame.K_UP, pygame.K_w):
                        continue
                    if self.state == "ready":
                        self.state = "playing"
                        self.bird.flap()
                    elif self.state == "playing":
                        self.bird.flap()
                    elif self.state == "game_over":
                        self.reset()

            self.update(dt)
            self.draw()
            pygame.display.flip()

        self._save_highscore()
        pygame.quit()

    def update(self, dt: float) -> None:
        self.scene.update(dt)
        self.bird.update(dt, game_state=self.state)
        self.flash_time = max(0.0, self.flash_time - dt)

        if self.state == "playing":
            self.spawn_timer += dt
            if self.spawn_timer >= PIPE_SPAWN_INTERVAL:
                self.spawn_timer -= PIPE_SPAWN_INTERVAL
                self._spawn_pipe()

            for pipe in list(self.pipes):
                pipe.update(dt)
                if pipe.is_off_screen():
                    self.pipes.remove(pipe)
                elif not pipe.passed and pipe.x + pipe.WIDTH < self.bird.x:
                    pipe.passed = True
                    self.score += 1
                    self.best_score = max(self.best_score, self.score)

            if self._check_collisions():
                self.state = "game_over"
                self.flash_time = 0.3
        else:
            for pipe in self.pipes:
                pipe.update(dt)

        ground_y = HEIGHT - GROUND_HEIGHT - 10
        if self.bird.y > ground_y:
            self.bird.y = ground_y
            if self.state == "playing":
                self.state = "game_over"
                self.flash_time = 0.3

        if self.bird.y < -80:
            self.bird.y = -80
            self.bird.velocity = 0

    def draw(self) -> None:
        self.scene.draw(self.screen)

        for pipe in self.pipes:
            pipe.draw(self.screen)

        self.bird.draw(self.screen)

        if self.flash_time > 0:
            overlay = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
            overlay.fill((255, 255, 255, int(180 * (self.flash_time / 0.3))))
            self.screen.blit(overlay, (0, 0))

        self.score_display.draw_highscore(self.screen, self.best_score)

        if self.state == "playing":
            self.score_display.draw_score(self.screen, self.score)
        elif self.state == "ready":
            self._draw_start_prompt()
        elif self.state == "game_over":
            self.score_display.draw_score(self.screen, self.score)
            self.score_display.draw_message(
                self.screen,
                "Game Over",
                "Click or press SPACE to try again",
            )

    def _draw_start_prompt(self) -> None:
        overlay = pygame.Surface((WIDTH, HEIGHT), pygame.SRCALPHA)
        overlay.fill((0, 0, 0, 80))
        self.screen.blit(overlay, (0, 0))
        self.score_display.draw_message(
            self.screen,
            "Dreamy Flight",
            "Click or press SPACE to start",
        )

    def _spawn_pipe(self) -> None:
        gap_progress = min(1.0, self.score / 12)
        gap_size = PIPE_GAP_BASE - (PIPE_GAP_BASE - PIPE_GAP_MIN) * gap_progress
        margin = 120
        gap_y = random.randint(int(margin + gap_size / 2), int(HEIGHT - GROUND_HEIGHT - margin - gap_size / 2))
        self.pipes.append(PipePair(WIDTH + 40, gap_y, gap_size))

    def _check_collisions(self) -> bool:
        bird_rects = self.bird.get_collision_rects()
        for pipe in self.pipes:
            if any(rect.colliderect(pipe.top_rect) or rect.colliderect(pipe.bottom_rect) for rect in bird_rects):
                return True
        return False

    def _load_highscore(self) -> int:
        try:
            return int(HIGHSCORE_FILE.read_text().strip())
        except Exception:
            return 0

    def _save_highscore(self) -> None:
        try:
            HIGHSCORE_FILE.write_text(str(self.best_score))
        except Exception:
            pass


def main() -> None:
    Game().run()


if __name__ == "__main__":
    main()
