import argparse
import json
from datetime import datetime
from pathlib import Path

TASKS_FILE = Path('tasks.json')


def load_tasks():
    if TASKS_FILE.exists():
        with TASKS_FILE.open('r', encoding='utf-8') as f:
            return json.load(f)
    return []


def save_tasks(tasks):
    with TASKS_FILE.open('w', encoding='utf-8') as f:
        json.dump(tasks, f, ensure_ascii=False, indent=2)


def add_task(args):
    tasks = load_tasks()
    task = {
        'beschrijving': args.description,
        'deadline': args.deadline,
        'type': args.type
    }
    tasks.append(task)
    save_tasks(tasks)
    print('Taak toegevoegd:')
    print_task(task)


def list_tasks(_args):
    tasks = load_tasks()
    tasks.sort(key=lambda t: t['deadline'])
    if not tasks:
        print('Geen taken gevonden.')
        return
    for idx, task in enumerate(tasks, 1):
        print(f"{idx}. {task['beschrijving']} ({task['type']}) - {task['deadline']}")


def print_task(task):
    print(f"- {task['beschrijving']} ({task['type']}) - {task['deadline']}")


def valid_date(date_str):
    try:
        datetime.strptime(date_str, '%Y-%m-%d')
        return date_str
    except ValueError as e:
        raise argparse.ArgumentTypeError(f'Onjuiste datum: {date_str}') from e


parser = argparse.ArgumentParser(description='Plan taken voor studenten.')
subparsers = parser.add_subparsers(dest='command')

add_parser = subparsers.add_parser('add', help='Voeg een nieuwe taak toe')
add_parser.add_argument('description', help='Beschrijving van de taak')
add_parser.add_argument('deadline', type=valid_date, help='Deadline (YYYY-MM-DD)')
add_parser.add_argument('--type', choices=['huiswerk', 'stage'], default='huiswerk', help='Type taak')
add_parser.set_defaults(func=add_task)

list_parser = subparsers.add_parser('list', help='Lijst alle taken')
list_parser.set_defaults(func=list_tasks)

args = parser.parse_args()
if hasattr(args, 'func'):
    args.func(args)
else:
    parser.print_help()
