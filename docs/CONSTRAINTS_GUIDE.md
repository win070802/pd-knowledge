# Constraints Guide

**Author:** Tran Minh Khoi, IT Department, Phat Dat Holdings

## What are Constraints?
Constraints are pre-defined rules or answers for common questions (e.g., company policies, HR, IT, etc.). They provide instant answers without searching documents.

## How Constraints Work
- Stored in the `constraints` table
- Each constraint has: `pattern`, `answer`, `priority`, `active`
- When a question matches a pattern, the system returns the constraint answer immediately

## Managing Constraints
- Admins can add/update constraints via API or DB
- Constraints are prioritized by `priority` (higher = more important)
- Only `active` constraints are used

## Example
- Pattern: "What is the leave policy?"
- Answer: "12 days per year for all employees."

---
**Contact: Tran Minh Khoi, IT Department, Phat Dat Holdings** 